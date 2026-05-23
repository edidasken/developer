(function () {
  'use strict';

  const SECTION_KEY = 'the_family';
  const SECTION_TITLE = 'The Family';
  const AUTH_LEVEL = 0;
  const STORAGE_KEY = 'newspaper:the_family:cache';
  const SERVICE_WORKER_CANDIDATES = [
    '../../service-worker.js',
    '../../../service-worker.js',
    '../../sw.js',
    '../../../sw.js'
  ];

  const FALLBACK_GENEALOGY = [
    {
      id: 'abraham',
      name: 'Abraham',
      era: 'Patriarch',
      bio: 'Father of many nations and a witness to covenant faithfulness.',
      scripture: 'Genesis 12–25'
    },
    {
      id: 'isaac',
      name: 'Isaac',
      era: 'Patriarch',
      bio: 'The promised son whose life marked continuity in God’s covenant people.',
      scripture: 'Genesis 21–35'
    },
    {
      id: 'jacob',
      name: 'Jacob',
      era: 'Patriarch',
      bio: 'Israel, whose family lines became the tribes of the nation.',
      scripture: 'Genesis 25–50'
    },
    {
      id: 'joseph',
      name: 'Joseph',
      era: 'Deliverer',
      bio: 'Preserved the family through famine and pointed toward providence.',
      scripture: 'Genesis 37–50'
    }
  ];

  let _drawerBound = false;
  let _allMembers = [];
  let _visibleMembers = [];
  let _allGroups = [];
  let _genealogy = [];
  let _searchText = '';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  }

  function getShellInit() {
    if (window.NewspaperShell && typeof window.NewspaperShell.initializeSectionShell === 'function') {
      return window.NewspaperShell.initializeSectionShell;
    }
    if (typeof window.initializeSectionShell === 'function') {
      return window.initializeSectionShell;
    }
    return null;
  }

  function initializeShell() {
    const shellInit = getShellInit();
    if (typeof shellInit !== 'function') {
      return null;
    }

    return shellInit({
      sectionId: SECTION_KEY,
      title: SECTION_TITLE,
      authLevel: AUTH_LEVEL,
      pageRoot: document.getElementById('the-family-grid')
    });
  }

  function getGates() {
    return window.FlockGates || {};
  }

  function getFlockApi() {
    const vine = window.TheVine && window.TheVine.flock ? window.TheVine.flock : null;
    const upperRoom = window.UpperRoom || null;
    return { vine, upperRoom };
  }

  function readCache() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function extractRows(result) {
    if (Array.isArray(result)) {
      return result;
    }

    if (!result || typeof result !== 'object') {
      return [];
    }

    if (Array.isArray(result.rows)) return result.rows;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.result)) return result.result;

    return [];
  }

  function getText(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || '';
    }
    return String(value);
  }

  function normalizeMember(raw) {
    return {
      id: getText(raw && (raw.id || raw.memberId || raw._id), getText(raw && raw.name, 'member')),
      name: getText(raw && (raw.name || raw.displayName || raw.fullName), 'Unnamed member'),
      role: getText(raw && (raw.role || raw.membershipRole || raw.memberRole), ''),
      household: getText(raw && (raw.household || raw.householdName || raw.family || raw.familyName), ''),
      status: getText(raw && (raw.membershipStatus || raw.status), 'member'),
      contact: getText(raw && (raw.phone || raw.email || raw.contact), ''),
      dob: getText(raw && (raw.dob || raw.birthDate || raw.birthday), ''),
      milestones: Array.isArray(raw && raw.milestones) ? raw.milestones : [],
      raw: raw || {}
    };
  }

  function normalizeGroup(raw) {
    const members = Array.isArray(raw && raw.members) ? raw.members : [];
    return {
      id: getText(raw && (raw.id || raw.groupId || raw._id), getText(raw && (raw.name || raw.title), 'group')),
      name: getText(raw && (raw.name || raw.title), 'Untitled group'),
      leader: getText(raw && (raw.leader || raw.leaderName), ''),
      time: getText(raw && (raw.meetingTime || raw.time || raw.schedule), ''),
      location: getText(raw && (raw.location || raw.meetingPlace), ''),
      members: members.map((entry) => getText(entry && (entry.name || entry.displayName || entry.fullName), String(entry || ''))).filter(Boolean),
      openPositions: Array.isArray(raw && raw.openPositions) ? raw.openPositions.map(String) : [],
      raw: raw || {}
    };
  }

  function normalizeGenealogyEntry(raw, index) {
    if (!raw || typeof raw !== 'object') {
      return {
        id: 'genealogy-' + index,
        name: 'Untitled figure',
        era: '',
        bio: '',
        scripture: ''
      };
    }

    return {
      id: getText(raw.id || raw.personId || raw.slug, 'genealogy-' + index),
      name: getText(raw.name || raw.title || raw.person, 'Untitled figure'),
      era: getText(raw.era || raw.category || raw.group || raw.period, ''),
      bio: getText(raw.bio || raw.summary || raw.description, ''),
      scripture: getText(raw.scripture || raw.reference || raw.ref, '')
    };
  }

  async function loadScript(url) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.src && script.src.indexOf(url) !== -1);
      if (existing) {
        resolve(existing);
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(script);
    });
  }

  function extractGenealogySource(moduleValue) {
    if (!moduleValue) return [];
    if (Array.isArray(moduleValue)) return moduleValue;
    if (Array.isArray(moduleValue.default)) return moduleValue.default;
    if (Array.isArray(moduleValue.genealogy)) return moduleValue.genealogy;
    if (Array.isArray(moduleValue.entries)) return moduleValue.entries;
    if (Array.isArray(moduleValue.data)) return moduleValue.data;
    return [];
  }

  async function loadGenealogy() {
    const candidates = [
      '../../Data/genealogy.js',
      '../../../Data/genealogy.js',
      '../../Data/genealogy.mjs',
      '../../../Data/genealogy.mjs'
    ];

    for (const candidate of candidates) {
      try {
        const mod = await import(candidate);
        const moduleRows = extractGenealogySource(mod);
        if (moduleRows.length) {
          return moduleRows.map(normalizeGenealogyEntry);
        }

        const globals = extractGenealogySource(window.GENEALOGY || window.genealogyData || window.GenealogyData || window.biblicalGenealogy || window.GENEALOGY_DATA);
        if (globals.length) {
          return globals.map(normalizeGenealogyEntry);
        }
      } catch (error) {
        // Try the next candidate.
      }
    }

    return FALLBACK_GENEALOGY.slice();
  }

  async function loadMembersAndGroups() {
    const { vine, upperRoom } = getFlockApi();
    const tasks = [];

    if (vine && vine.members && typeof vine.members.list === 'function') {
      tasks.push(vine.members.list({ limit: 200 }));
    } else if (upperRoom && typeof upperRoom.listMembers === 'function') {
      tasks.push(upperRoom.listMembers({ limit: 200 }));
    } else {
      tasks.push(Promise.resolve([]));
    }

    if (vine && vine.groups && typeof vine.groups.list === 'function') {
      tasks.push(vine.groups.list({ limit: 100 }));
    } else if (upperRoom && typeof upperRoom.listGroups === 'function') {
      tasks.push(upperRoom.listGroups({ limit: 100 }));
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [membersResult, groupsResult] = await Promise.allSettled(tasks);

    const members = extractRows(membersResult.status === 'fulfilled' ? membersResult.value : []);
    const groups = extractRows(groupsResult.status === 'fulfilled' ? groupsResult.value : []);

    const data = {
      members: members.map(normalizeMember),
      groups: groups.map(normalizeGroup)
    };

    if (data.members.length || data.groups.length) {
      writeCache(data);
      return data;
    }

    const cached = readCache();
    if (cached) {
      return {
        members: Array.isArray(cached.members) ? cached.members.map(normalizeMember) : [],
        groups: Array.isArray(cached.groups) ? cached.groups.map(normalizeGroup) : []
      };
    }

    return { members: [], groups: [] };
  }

  function clearGrid(root) {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
  }

  function buildSectionRule(label) {
    const rule = document.createElement('div');
    rule.className = 'section-rule';

    const span = document.createElement('span');
    span.className = 'section-label';
    span.textContent = label;

    rule.appendChild(span);
    return rule;
  }

  function buildStatsRow(members, groups) {
    const wrap = document.createElement('div');
    wrap.className = 'family-stats';

    const stats = [
      { label: 'Members', value: String(members.length) },
      { label: 'Groups', value: String(groups.length) },
      { label: 'Households', value: String(new Set(members.map((member) => member.household).filter(Boolean)).size) }
    ];

    stats.forEach((stat) => {
      const chip = document.createElement('div');
      chip.className = 'family-stat-chip';

      const value = document.createElement('strong');
      value.textContent = stat.value;

      const label = document.createElement('span');
      label.textContent = stat.label;

      chip.appendChild(value);
      chip.appendChild(label);
      wrap.appendChild(chip);
    });

    return wrap;
  }

  function createSearchBar() {
    const wrap = document.createElement('div');
    wrap.className = 'family-search-wrap';

    const input = document.createElement('input');
    input.type = 'search';
    input.id = 'family-search';
    input.className = 'family-search';
    input.placeholder = 'Search members or households…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Search members or households');

    wrap.appendChild(input);
    return wrap;
  }

  function matchesSearch(member, query) {
    if (!query) return true;
    const haystack = [
      member.name,
      member.role,
      member.household,
      member.status,
      member.contact,
      member.dob
    ].join(' ').toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function buildMemberRow(member) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-card family-member-row';
    button.dataset.memberId = member.id;

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = member.name;
    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    if (member.role) {
      const role = document.createElement('span');
      role.className = 'entry-status';
      role.textContent = member.role;
      meta.appendChild(role);
    }

    if (member.household) {
      const household = document.createElement('span');
      household.className = 'entry-meta';
      household.textContent = member.household;
      meta.appendChild(household);
    }

    if (member.status) {
      const status = document.createElement('span');
      status.className = 'entry-meta';
      status.textContent = member.status;
      meta.appendChild(status);
    }

    head.appendChild(meta);
    button.appendChild(head);

    if (member.contact) {
      const contact = document.createElement('p');
      contact.className = 'entry-summary';
      contact.textContent = member.contact;
      button.appendChild(contact);
    }

    return button;
  }

  function buildMemberDrawer(member) {
    const wrap = document.createElement('div');
    wrap.className = 'family-drawer';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'MEMBER DIRECTORY';
    wrap.appendChild(kicker);

    const title = document.createElement('h3');
    title.className = 'story-hed';
    title.textContent = member.name;
    wrap.appendChild(title);

    const deck = document.createElement('p');
    deck.className = 'story-deck';
    const bits = [];
    if (member.role) bits.push(member.role);
    if (member.household) bits.push(member.household);
    if (member.status) bits.push(member.status);
    deck.textContent = bits.join(' · ');
    wrap.appendChild(deck);

    if (member.contact) {
      const contact = document.createElement('p');
      contact.className = 'story-body';
      contact.textContent = 'Contact: ' + member.contact;
      wrap.appendChild(contact);
    }

    if (member.dob) {
      const dob = document.createElement('p');
      dob.className = 'entry-meta';
      dob.textContent = 'Birthday: ' + member.dob;
      wrap.appendChild(dob);
    }

    if (member.milestones && member.milestones.length) {
      const section = document.createElement('div');
      section.className = 'family-drawer-section';

      const heading = document.createElement('h4');
      heading.className = 'section-label';
      heading.textContent = 'Milestones';
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'drawer-list';

      member.milestones.forEach((milestone) => {
        const item = document.createElement('li');
        item.className = 'drawer-list__item';
        item.textContent = String(milestone && (milestone.label || milestone.title || milestone.name || milestone) || '');
        list.appendChild(item);
      });

      section.appendChild(list);
      wrap.appendChild(section);
    }

    return wrap;
  }

  function buildGenealogyCard(figure) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-card family-genealogy-row';
    button.dataset.figureId = figure.id;

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = figure.name;
    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    if (figure.era) {
      const era = document.createElement('span');
      era.className = 'entry-status';
      era.textContent = figure.era;
      meta.appendChild(era);
    }

    if (figure.scripture) {
      const scripture = document.createElement('span');
      scripture.className = 'entry-meta';
      scripture.textContent = figure.scripture;
      meta.appendChild(scripture);
    }

    head.appendChild(meta);
    button.appendChild(head);

    if (figure.bio) {
      const bio = document.createElement('p');
      bio.className = 'entry-summary';
      bio.textContent = figure.bio;
      button.appendChild(bio);
    }

    return button;
  }

  function buildGenealogyDrawer(figure) {
    const wrap = document.createElement('div');
    wrap.className = 'family-drawer';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'BIBLICAL GENEALOGY';
    wrap.appendChild(kicker);

    const title = document.createElement('h3');
    title.className = 'story-hed';
    title.textContent = figure.name;
    wrap.appendChild(title);

    if (figure.era) {
      const deck = document.createElement('p');
      deck.className = 'story-deck';
      deck.textContent = figure.era;
      wrap.appendChild(deck);
    }

    if (figure.scripture) {
      const reference = document.createElement('p');
      reference.className = 'entry-meta';
      reference.textContent = figure.scripture;
      wrap.appendChild(reference);
    }

    if (figure.bio) {
      const body = document.createElement('p');
      body.className = 'story-body';
      body.textContent = figure.bio;
      wrap.appendChild(body);
    }

    return wrap;
  }

  function openDrawer(title, node) {
    const gates = getGates();
    if (typeof gates.openDrawer !== 'function') {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(node);
    gates.openDrawer(title, wrapper.innerHTML);
  }

  function renderMembersSection(members, groups) {
    const article = document.createElement('article');
    article.className = 'broadsheet-card broadsheet-card--full family-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'MEMBER DIRECTORY';

    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = 'The Family of the Church';

    const subtitle = document.createElement('p');
    subtitle.className = 'card-subtitle';
    subtitle.textContent = 'Search the flock by name, household, role, or contact line.';

    header.appendChild(kicker);
    header.appendChild(title);
    header.appendChild(subtitle);

    article.appendChild(header);
    article.appendChild(buildStatsRow(members, groups));
    article.appendChild(createSearchBar());

    const list = document.createElement('div');
    list.id = 'family-member-list';
    list.className = 'entry-list family-entry-list';

    if (!members.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No member records were returned yet.';
      list.appendChild(empty);
    } else {
      members.forEach((member) => {
        list.appendChild(buildMemberRow(member));
      });
    }

    article.appendChild(list);
    return article;
  }

  function renderGenealogySection(genealogy) {
    const article = document.createElement('article');
    article.className = 'broadsheet-card broadsheet-card--full family-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'BIBLICAL FAMILY';

    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = 'Genealogy Explorer';

    const subtitle = document.createElement('p');
    subtitle.className = 'card-subtitle';
    subtitle.textContent = 'Trace the family lines that shaped Scripture.';

    header.appendChild(kicker);
    header.appendChild(title);
    header.appendChild(subtitle);

    article.appendChild(buildSectionRule('BIBLICAL FIGURES'));
    article.appendChild(header);

    const list = document.createElement('div');
    list.className = 'entry-list family-genealogy-list';

    if (!genealogy.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No genealogy records are available right now.';
      list.appendChild(empty);
    } else {
      genealogy.forEach((figure) => {
        list.appendChild(buildGenealogyCard(figure));
      });
    }

    article.appendChild(list);
    return article;
  }

  function renderPage(data) {
    const root = document.getElementById('the-family-grid');
    if (!root) return;

    clearGrid(root);
    root.appendChild(renderMembersSection(data.members, data.groups));
    root.appendChild(renderGenealogySection(data.genealogy));
  }

  function bindDrawerEvents() {
    if (_drawerBound) return;

    const body = document.getElementById('drawer-body');
    if (!body) return;

    body.addEventListener('click', (event) => {
      const memberButton = event.target.closest('[data-member-id]');
      if (memberButton) {
        const member = _allMembers.find((entry) => entry.id === memberButton.dataset.memberId);
        if (member) {
          openDrawer(member.name, buildMemberDrawer(member));
        }
        return;
      }

      const figureButton = event.target.closest('[data-figure-id]');
      if (figureButton) {
        const figure = _genealogy.find((entry) => entry.id === figureButton.dataset.figureId);
        if (figure) {
          openDrawer(figure.name, buildGenealogyDrawer(figure));
        }
      }
    });

    _drawerBound = true;
  }

  function bindSearch() {
    const input = document.getElementById('family-search');
    if (!input) return;

    input.addEventListener('input', () => {
      _searchText = input.value.trim().toLowerCase();
      applySearchFilter();
    });
  }

  function applySearchFilter() {
    const list = document.getElementById('family-member-list');
    if (!list) return;

    _visibleMembers = _allMembers.filter((member) => matchesSearch(member, _searchText));
    list.innerHTML = '';

    if (!_visibleMembers.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No members match that search.';
      list.appendChild(empty);
      return;
    }

    _visibleMembers.forEach((member) => {
      list.appendChild(buildMemberRow(member));
    });
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    for (const candidate of SERVICE_WORKER_CANDIDATES) {
      try {
        await navigator.serviceWorker.register(candidate);
        return;
      } catch (error) {
        // Try the next candidate.
      }
    }
  }

  async function initializePage() {
    initializeShell();
    bindDrawerEvents();

    const loaded = await loadMembersAndGroups();
    _allMembers = loaded.members;
    _visibleMembers = loaded.members;
    _allGroups = loaded.groups;
    _genealogy = (await loadGenealogy()).map(normalizeGenealogyEntry);

    renderPage({
      members: _allMembers,
      groups: _allGroups,
      genealogy: _genealogy
    });

    bindSearch();
    registerServiceWorker().catch(() => {});
  }

  onReady(() => {
    initializePage().catch((error) => {
      console.error('[The Family] Failed to initialize section:', error);
      const root = document.getElementById('the-family-grid');
      if (!root) return;

      clearGrid(root);
      const fallback = document.createElement('article');
      fallback.className = 'broadsheet-card broadsheet-card--full';
      const message = document.createElement('div');
      message.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-state__icon';
      icon.textContent = '👨‍👩‍👧‍👦';

      const title = document.createElement('p');
      title.className = 'empty-state__title';
      title.textContent = 'The Family could not load';

      const body = document.createElement('p');
      body.className = 'empty-state__message';
      body.textContent = 'Try again after the member directory connection is available.';

      message.appendChild(icon);
      message.appendChild(title);
      message.appendChild(body);
      fallback.appendChild(message);
      root.appendChild(fallback);
    });
  });
})();
