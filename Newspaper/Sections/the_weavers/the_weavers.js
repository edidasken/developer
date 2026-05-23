(function () {
  'use strict';

  const SECTION_KEY = 'the_weavers';
  const SECTION_TITLE = 'The Weavers';
  const AUTH_LEVEL = 3;
  const STORAGE_KEY = 'newspaper:the_weavers:cache';
  const SERVICE_WORKER_CANDIDATES = ['../../sw.js'];

  const FALLBACK_VOLUNTEERS = [
    {
      id: 'worship-helpers',
      name: 'Worship Helpers',
      team: 'Worship',
      role: 'Setup / tear-down',
      schedule: 'Sunday 7:30 AM',
      contact: 'Need 2 more volunteers',
      openPosition: 'Ushers, media, and hospitality'
    },
    {
      id: 'kids-team',
      name: 'Kids Team',
      team: 'Children',
      role: 'Classroom care',
      schedule: 'Sunday 9:00 AM',
      contact: 'Coordinator assigned',
      openPosition: 'Check-in and teaching support'
    },
    {
      id: 'prayer-watch',
      name: 'Prayer Watch',
      team: 'Prayer',
      role: 'Intercession',
      schedule: 'Wednesday 6:30 PM',
      contact: 'Rotation in progress',
      openPosition: 'Pray-ers for the evening watch'
    }
  ];

  const FALLBACK_GROUPS = [
    {
      id: 'sunday-school',
      name: 'Sunday School Class',
      leader: 'Teacher rotation',
      time: 'Sunday 9:30 AM',
      location: 'Education wing',
      members: ['Adults', 'Youth', 'Children'],
      description: 'A weekly teaching group for discipleship and study.'
    },
    {
      id: 'midweek-prayer',
      name: 'Midweek Prayer Circle',
      leader: 'Prayer team',
      time: 'Wednesday 6:30 PM',
      location: 'Main sanctuary',
      members: ['Intercessors', 'Care partners'],
      description: 'A focused group for intercession, care, and testimony.'
    },
    {
      id: 'young-families',
      name: 'Young Families Group',
      leader: 'Volunteer leaders',
      time: 'Friday 7:00 PM',
      location: 'Family hall',
      members: ['Young couples', 'Parents', 'Children'],
      description: 'A small group for fellowship, support, and shared meals.'
    }
  ];

  let _drawerBound = false;
  let _allVolunteers = [];
  let _visibleVolunteers = [];
  let _allGroups = [];
  let _searchText = '';
  let _activeTeam = 'all';

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
      pageRoot: document.getElementById('the-weavers-grid')
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

  function normalizeVolunteer(raw) {
    const name = getText(raw && (raw.name || raw.title || raw.teamName), 'Unnamed volunteer team');
    return {
      id: getText(raw && (raw.id || raw.volunteerId || raw._id), name),
      name,
      team: getText(raw && (raw.team || raw.ministry || raw.category), ''),
      role: getText(raw && (raw.role || raw.position || raw.assignment), ''),
      schedule: getText(raw && (raw.schedule || raw.meetingTime || raw.time), ''),
      leader: getText(raw && (raw.leader || raw.coordinator || raw.contactName), ''),
      contact: getText(raw && (raw.contact || raw.phone || raw.email), ''),
      openPosition: getText(raw && (raw.openPosition || raw.need || raw.needHelp), ''),
      notes: getText(raw && (raw.notes || raw.description || raw.summary), ''),
      members: Array.isArray(raw && raw.members) ? raw.members.map((entry) => getText(entry && (entry.name || entry.displayName || entry.fullName), String(entry || ''))).filter(Boolean) : [],
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
      description: getText(raw && (raw.description || raw.summary || raw.notes), ''),
      members: members.map((entry) => getText(entry && (entry.name || entry.displayName || entry.fullName), String(entry || ''))).filter(Boolean),
      openPositions: Array.isArray(raw && raw.openPositions) ? raw.openPositions.map(String) : [],
      raw: raw || {}
    };
  }

  function normalizeCachedData(data) {
    return {
      volunteers: Array.isArray(data && data.volunteers) ? data.volunteers.map(normalizeVolunteer) : [],
      groups: Array.isArray(data && data.groups) ? data.groups.map(normalizeGroup) : []
    };
  }

  async function loadSectionData() {
    const { vine, upperRoom } = getFlockApi();
    const tasks = [];

    if (vine && vine.volunteers && typeof vine.volunteers.list === 'function') {
      tasks.push(vine.volunteers.list({ limit: 100 }));
    } else if (upperRoom && typeof upperRoom.listVolunteers === 'function') {
      tasks.push(upperRoom.listVolunteers({ limit: 100 }));
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

    const [volunteersResult, groupsResult] = await Promise.allSettled(tasks);

    const volunteers = extractRows(volunteersResult.status === 'fulfilled' ? volunteersResult.value : []);
    const groups = extractRows(groupsResult.status === 'fulfilled' ? groupsResult.value : []);

    const liveData = {
      volunteers: volunteers.map(normalizeVolunteer),
      groups: groups.map(normalizeGroup)
    };

    if (liveData.volunteers.length || liveData.groups.length) {
      writeCache(liveData);
      return liveData;
    }

    const cached = readCache();
    if (cached) {
      return normalizeCachedData(cached);
    }

    return {
      volunteers: FALLBACK_VOLUNTEERS.slice(),
      groups: FALLBACK_GROUPS.slice()
    };
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

  function buildStatsRow(volunteers, groups) {
    const wrap = document.createElement('div');
    wrap.className = 'weavers-stats';

    const teamCount = new Set(volunteers.map((entry) => entry.team).filter(Boolean)).size;
    const stats = [
      { label: 'Volunteers', value: String(volunteers.length) },
      { label: 'Groups', value: String(groups.length) },
      { label: 'Teams', value: String(teamCount) }
    ];

    stats.forEach((stat) => {
      const chip = document.createElement('div');
      chip.className = 'weavers-stat-chip';

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
    wrap.className = 'weavers-search-wrap';

    const input = document.createElement('input');
    input.type = 'search';
    input.id = 'weavers-search';
    input.className = 'weavers-search';
    input.placeholder = 'Search teams, leaders, or roles…';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Search teams, leaders, or roles');

    wrap.appendChild(input);
    return wrap;
  }

  function buildTeamFilters(volunteers) {
    const wrap = document.createElement('div');
    wrap.className = 'weavers-filter-row';

    const teams = ['all'].concat(
      Array.from(new Set(volunteers.map((entry) => entry.team).filter(Boolean))).sort()
    );

    teams.forEach((team) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'weavers-filter-chip' + (team === _activeTeam ? ' is-active' : '');
      button.dataset.team = team;
      button.textContent = team === 'all' ? 'All Teams' : team;
      wrap.appendChild(button);
    });

    return wrap;
  }

  function matchesSearch(volunteer, query) {
    if (!query) return true;
    const haystack = [
      volunteer.name,
      volunteer.team,
      volunteer.role,
      volunteer.schedule,
      volunteer.leader,
      volunteer.contact,
      volunteer.openPosition,
      volunteer.notes
    ].join(' ').toLowerCase();

    return haystack.indexOf(query) !== -1;
  }

  function matchesTeam(volunteer, team) {
    if (team === 'all') return true;
    return (volunteer.team || '').toLowerCase() === String(team).toLowerCase();
  }

  function buildVolunteerRow(volunteer) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-card weavers-volunteer-row';
    button.dataset.volunteerId = volunteer.id;

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = volunteer.name;
    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    if (volunteer.team) {
      const team = document.createElement('span');
      team.className = 'entry-status';
      team.textContent = volunteer.team;
      meta.appendChild(team);
    }

    if (volunteer.schedule) {
      const schedule = document.createElement('span');
      schedule.className = 'entry-meta';
      schedule.textContent = volunteer.schedule;
      meta.appendChild(schedule);
    }

    head.appendChild(meta);
    button.appendChild(head);

    if (volunteer.role) {
      const role = document.createElement('p');
      role.className = 'entry-summary';
      role.textContent = volunteer.role;
      button.appendChild(role);
    }

    if (volunteer.openPosition) {
      const position = document.createElement('p');
      position.className = 'entry-details';
      position.textContent = volunteer.openPosition;
      button.appendChild(position);
    }

    return button;
  }

  function buildGroupRow(group) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-card weavers-group-row';
    button.dataset.groupId = group.id;

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = group.name;
    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    if (group.leader) {
      const leader = document.createElement('span');
      leader.className = 'entry-status';
      leader.textContent = group.leader;
      meta.appendChild(leader);
    }

    if (group.time) {
      const time = document.createElement('span');
      time.className = 'entry-meta';
      time.textContent = group.time;
      meta.appendChild(time);
    }

    head.appendChild(meta);
    button.appendChild(head);

    if (group.location) {
      const location = document.createElement('p');
      location.className = 'entry-summary';
      location.textContent = group.location;
      button.appendChild(location);
    }

    if (group.description) {
      const description = document.createElement('p');
      description.className = 'entry-details';
      description.textContent = group.description;
      button.appendChild(description);
    }

    return button;
  }

  function buildVolunteerDrawer(volunteer) {
    const wrap = document.createElement('div');
    wrap.className = 'weavers-drawer';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'VOLUNTEER ROSTER';
    wrap.appendChild(kicker);

    const title = document.createElement('h3');
    title.className = 'story-hed';
    title.textContent = volunteer.name;
    wrap.appendChild(title);

    const deck = document.createElement('p');
    deck.className = 'story-deck';
    const bits = [];
    if (volunteer.team) bits.push(volunteer.team);
    if (volunteer.role) bits.push(volunteer.role);
    if (volunteer.schedule) bits.push(volunteer.schedule);
    deck.textContent = bits.join(' · ');
    wrap.appendChild(deck);

    if (volunteer.contact) {
      const contact = document.createElement('p');
      contact.className = 'story-body';
      contact.textContent = volunteer.contact;
      wrap.appendChild(contact);
    }

    if (volunteer.notes) {
      const notes = document.createElement('p');
      notes.className = 'entry-meta';
      notes.textContent = volunteer.notes;
      wrap.appendChild(notes);
    }

    const form = document.createElement('form');
    form.className = 'weavers-action-form';
    form.dataset.scheduleVolunteerId = volunteer.id;

    const heading = document.createElement('h4');
    heading.className = 'section-label';
    heading.textContent = 'Schedule Volunteer';
    form.appendChild(heading);

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.name = 'date';
    dateInput.className = 'weavers-input';
    dateInput.required = true;

    const roleInput = document.createElement('input');
    roleInput.type = 'text';
    roleInput.name = 'role';
    roleInput.className = 'weavers-input';
    roleInput.placeholder = 'Assigned role or service';
    roleInput.required = true;

    const notesInput = document.createElement('textarea');
    notesInput.name = 'notes';
    notesInput.className = 'weavers-input weavers-textarea';
    notesInput.placeholder = 'Optional notes';
    notesInput.rows = 3;

    const buttonRow = document.createElement('div');
    buttonRow.className = 'weavers-action-row';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'broadsheet-button';
    submit.textContent = 'Save schedule';
    buttonRow.appendChild(submit);

    form.appendChild(dateInput);
    form.appendChild(roleInput);
    form.appendChild(notesInput);
    form.appendChild(buttonRow);
    wrap.appendChild(form);

    const swapForm = document.createElement('form');
    swapForm.className = 'weavers-action-form';
    swapForm.dataset.swapVolunteerId = volunteer.id;

    const swapHeading = document.createElement('h4');
    swapHeading.className = 'section-label';
    swapHeading.textContent = 'Swap Volunteer';
    swapForm.appendChild(swapHeading);

    const swapInput = document.createElement('input');
    swapInput.type = 'text';
    swapInput.name = 'swapWith';
    swapInput.className = 'weavers-input';
    swapInput.placeholder = 'Swap with volunteer name or ID';
    swapInput.required = true;

    const swapNotes = document.createElement('textarea');
    swapNotes.name = 'notes';
    swapNotes.className = 'weavers-input weavers-textarea';
    swapNotes.placeholder = 'Reason for swap';
    swapNotes.rows = 3;

    const swapButtons = document.createElement('div');
    swapButtons.className = 'weavers-action-row';

    const swapSubmit = document.createElement('button');
    swapSubmit.type = 'submit';
    swapSubmit.className = 'broadsheet-button broadsheet-button--ghost';
    swapSubmit.textContent = 'Request swap';
    swapButtons.appendChild(swapSubmit);

    swapForm.appendChild(swapInput);
    swapForm.appendChild(swapNotes);
    swapForm.appendChild(swapButtons);
    wrap.appendChild(swapForm);

    return wrap;
  }

  function buildGroupDrawer(group) {
    const wrap = document.createElement('div');
    wrap.className = 'weavers-drawer';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'SMALL GROUP';
    wrap.appendChild(kicker);

    const title = document.createElement('h3');
    title.className = 'story-hed';
    title.textContent = group.name;
    wrap.appendChild(title);

    const deck = document.createElement('p');
    deck.className = 'story-deck';
    const bits = [];
    if (group.leader) bits.push(group.leader);
    if (group.time) bits.push(group.time);
    if (group.location) bits.push(group.location);
    deck.textContent = bits.join(' · ');
    wrap.appendChild(deck);

    if (group.description) {
      const body = document.createElement('p');
      body.className = 'story-body';
      body.textContent = group.description;
      wrap.appendChild(body);
    }

    if (group.members.length) {
      const section = document.createElement('div');
      section.className = 'weavers-drawer-section';

      const heading = document.createElement('h4');
      heading.className = 'section-label';
      heading.textContent = 'Members';
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'drawer-list';

      group.members.forEach((member) => {
        const item = document.createElement('li');
        item.className = 'drawer-list__item';
        item.textContent = member;
        list.appendChild(item);
      });

      section.appendChild(list);
      wrap.appendChild(section);
    }

    const addForm = document.createElement('form');
    addForm.className = 'weavers-action-form';
    addForm.dataset.groupAddMemberId = group.id;

    const addHeading = document.createElement('h4');
    addHeading.className = 'section-label';
    addHeading.textContent = 'Add Member';
    addForm.appendChild(addHeading);

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.name = 'member';
    addInput.className = 'weavers-input';
    addInput.placeholder = 'Member name';
    addInput.required = true;
    addForm.appendChild(addInput);

    const addButtons = document.createElement('div');
    addButtons.className = 'weavers-action-row';

    const addSubmit = document.createElement('button');
    addSubmit.type = 'submit';
    addSubmit.className = 'broadsheet-button';
    addSubmit.textContent = 'Add to group';
    addButtons.appendChild(addSubmit);

    addForm.appendChild(addButtons);
    wrap.appendChild(addForm);

    const removeForm = document.createElement('form');
    removeForm.className = 'weavers-action-form';
    removeForm.dataset.groupRemoveMemberId = group.id;

    const removeHeading = document.createElement('h4');
    removeHeading.className = 'section-label';
    removeHeading.textContent = 'Remove Member';
    removeForm.appendChild(removeHeading);

    const removeInput = document.createElement('input');
    removeInput.type = 'text';
    removeInput.name = 'member';
    removeInput.className = 'weavers-input';
    removeInput.placeholder = 'Member name';
    removeInput.required = true;
    removeForm.appendChild(removeInput);

    const removeButtons = document.createElement('div');
    removeButtons.className = 'weavers-action-row';

    const removeSubmit = document.createElement('button');
    removeSubmit.type = 'submit';
    removeSubmit.className = 'broadsheet-button broadsheet-button--ghost';
    removeSubmit.textContent = 'Remove from group';
    removeButtons.appendChild(removeSubmit);

    removeForm.appendChild(removeButtons);
    wrap.appendChild(removeForm);

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

  function findVolunteer(id) {
    return _allVolunteers.find((entry) => entry.id === id) || null;
  }

  function findGroup(id) {
    return _allGroups.find((entry) => entry.id === id) || null;
  }

  async function submitSchedule(volunteerId, fields) {
    const { vine, upperRoom } = getFlockApi();
    const payload = {
      volunteerId,
      date: fields.date,
      role: fields.role,
      notes: fields.notes || ''
    };

    if (vine && vine.volunteers && typeof vine.volunteers.schedule === 'function') {
      return vine.volunteers.schedule(payload);
    }

    if (upperRoom && typeof upperRoom.scheduleVolunteer === 'function') {
      return upperRoom.scheduleVolunteer(payload);
    }

    if (upperRoom && typeof upperRoom.volunteerSchedule === 'function') {
      return upperRoom.volunteerSchedule(payload);
    }

    return null;
  }

  async function submitSwap(volunteerId, fields) {
    const { vine, upperRoom } = getFlockApi();
    const payload = {
      volunteerId,
      swapWith: fields.swapWith,
      notes: fields.notes || ''
    };

    if (vine && vine.volunteers && typeof vine.volunteers.swap === 'function') {
      return vine.volunteers.swap(payload);
    }

    if (upperRoom && typeof upperRoom.swapVolunteer === 'function') {
      return upperRoom.swapVolunteer(payload);
    }

    if (upperRoom && typeof upperRoom.volunteerSwap === 'function') {
      return upperRoom.volunteerSwap(payload);
    }

    return null;
  }

  async function addGroupMember(groupId, memberName) {
    const { vine, upperRoom } = getFlockApi();
    const payload = {
      groupId,
      member: memberName,
      name: memberName
    };

    if (vine && vine.groups && typeof vine.groups.addMember === 'function') {
      return vine.groups.addMember(payload);
    }

    if (upperRoom && typeof upperRoom.addGroupMember === 'function') {
      return upperRoom.addGroupMember(payload);
    }

    if (upperRoom && typeof upperRoom.groupAddMember === 'function') {
      return upperRoom.groupAddMember(payload);
    }

    return null;
  }

  async function removeGroupMember(groupId, memberName) {
    const { vine, upperRoom } = getFlockApi();
    const payload = {
      groupId,
      member: memberName,
      name: memberName
    };

    if (vine && vine.groups && typeof vine.groups.removeMember === 'function') {
      return vine.groups.removeMember(payload);
    }

    if (upperRoom && typeof upperRoom.removeGroupMember === 'function') {
      return upperRoom.removeGroupMember(payload);
    }

    if (upperRoom && typeof upperRoom.groupRemoveMember === 'function') {
      return upperRoom.groupRemoveMember(payload);
    }

    return null;
  }

  function showToast(message) {
    const gates = getGates();
    if (typeof gates.showToast === 'function') {
      gates.showToast(message);
    }
  }

  function bindDrawerEvents() {
    if (_drawerBound) return;

    const body = document.getElementById('drawer-body');
    if (!body) return;

    body.addEventListener('click', (event) => {
      const volunteerButton = event.target.closest('[data-volunteer-id]');
      if (volunteerButton) {
        const volunteer = findVolunteer(volunteerButton.dataset.volunteerId);
        if (volunteer) {
          openDrawer(volunteer.name, buildVolunteerDrawer(volunteer));
        }
        return;
      }

      const groupButton = event.target.closest('[data-group-id]');
      if (groupButton) {
        const group = findGroup(groupButton.dataset.groupId);
        if (group) {
          openDrawer(group.name, buildGroupDrawer(group));
        }
      }
    });

    body.addEventListener('submit', async (event) => {
      const scheduleForm = event.target.closest('[data-schedule-volunteer-id]');
      const swapForm = event.target.closest('[data-swap-volunteer-id]');
      const addForm = event.target.closest('[data-group-add-member-id]');
      const removeForm = event.target.closest('[data-group-remove-member-id]');

      if (scheduleForm) {
        event.preventDefault();
        const volunteerId = scheduleForm.dataset.scheduleVolunteerId;
        const date = scheduleForm.querySelector('input[name="date"]');
        const role = scheduleForm.querySelector('input[name="role"]');
        const notes = scheduleForm.querySelector('textarea[name="notes"]');

        try {
          await submitSchedule(volunteerId, {
            date: date ? date.value : '',
            role: role ? role.value.trim() : '',
            notes: notes ? notes.value.trim() : ''
          });
          showToast('Volunteer scheduled');
        } catch (error) {
          console.warn('[The Weavers] Schedule request failed:', error);
          showToast('Could not save schedule');
        }
        return;
      }

      if (swapForm) {
        event.preventDefault();
        const volunteerId = swapForm.dataset.swapVolunteerId;
        const swapWith = swapForm.querySelector('input[name="swapWith"]');
        const notes = swapForm.querySelector('textarea[name="notes"]');

        try {
          await submitSwap(volunteerId, {
            swapWith: swapWith ? swapWith.value.trim() : '',
            notes: notes ? notes.value.trim() : ''
          });
          showToast('Swap requested');
        } catch (error) {
          console.warn('[The Weavers] Swap request failed:', error);
          showToast('Could not request swap');
        }
        return;
      }

      if (addForm) {
        event.preventDefault();
        const groupId = addForm.dataset.groupAddMemberId;
        const member = addForm.querySelector('input[name="member"]');

        try {
          await addGroupMember(groupId, member ? member.value.trim() : '');
          showToast('Member added');
        } catch (error) {
          console.warn('[The Weavers] Add member failed:', error);
          showToast('Could not add member');
        }
        return;
      }

      if (removeForm) {
        event.preventDefault();
        const groupId = removeForm.dataset.groupRemoveMemberId;
        const member = removeForm.querySelector('input[name="member"]');

        try {
          await removeGroupMember(groupId, member ? member.value.trim() : '');
          showToast('Member removed');
        } catch (error) {
          console.warn('[The Weavers] Remove member failed:', error);
          showToast('Could not remove member');
        }
      }
    });

    _drawerBound = true;
  }

  function renderVolunteerSection(volunteers) {
    const article = document.createElement('article');
    article.className = 'broadsheet-card broadsheet-card--full weavers-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'VOLUNTEER TEAMS';

    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = 'Roster and Schedule';

    const subtitle = document.createElement('p');
    subtitle.className = 'card-subtitle';
    subtitle.textContent = 'Search active teams, request swaps, and assign upcoming service slots.';

    header.appendChild(kicker);
    header.appendChild(title);
    header.appendChild(subtitle);

    article.appendChild(header);
    article.appendChild(buildStatsRow(volunteers, _allGroups));
    article.appendChild(createSearchBar());
    article.appendChild(buildTeamFilters(volunteers));

    const list = document.createElement('div');
    list.id = 'weavers-volunteer-list';
    list.className = 'entry-list weavers-entry-list';

    if (!volunteers.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No volunteer roster records were returned.';
      list.appendChild(empty);
    } else {
      volunteers.forEach((volunteer) => {
        list.appendChild(buildVolunteerRow(volunteer));
      });
    }

    article.appendChild(list);
    return article;
  }

  function renderGroupSection(groups) {
    const article = document.createElement('article');
    article.className = 'broadsheet-card broadsheet-card--full weavers-card';

    const header = document.createElement('header');
    header.className = 'card-header';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = 'SMALL GROUPS';

    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = 'Fellowship Groups';

    const subtitle = document.createElement('p');
    subtitle.className = 'card-subtitle';
    subtitle.textContent = 'Open a group to add members, review leaders, and adjust meeting details.';

    header.appendChild(kicker);
    header.appendChild(title);
    header.appendChild(subtitle);

    article.appendChild(buildSectionRule('GROUP ROSTER'));
    article.appendChild(header);

    const list = document.createElement('div');
    list.className = 'entry-list weavers-group-list';

    if (!groups.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No small groups are available right now.';
      list.appendChild(empty);
    } else {
      groups.forEach((group) => {
        list.appendChild(buildGroupRow(group));
      });
    }

    article.appendChild(list);
    return article;
  }

  function renderPage(data) {
    const root = document.getElementById('the-weavers-grid');
    if (!root) return;

    clearGrid(root);
    root.appendChild(renderVolunteerSection(data.volunteers));
    root.appendChild(renderGroupSection(data.groups));
  }

  function applySearchFilter() {
    const list = document.getElementById('weavers-volunteer-list');
    if (!list) return;

    const filtered = _allVolunteers.filter((entry) => {
      return matchesSearch(entry, _searchText) && matchesTeam(entry, _activeTeam);
    });

    _visibleVolunteers = filtered;
    list.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No volunteers match that filter.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((volunteer) => {
      list.appendChild(buildVolunteerRow(volunteer));
    });
  }

  function bindSearch() {
    const input = document.getElementById('weavers-search');
    if (input) {
      input.addEventListener('input', () => {
        _searchText = input.value.trim().toLowerCase();
        applySearchFilter();
      });
    }

    const filters = document.querySelector('.weavers-filter-row');
    if (filters) {
      filters.addEventListener('click', (event) => {
        const chip = event.target.closest('.weavers-filter-chip');
        if (!chip) return;

        _activeTeam = chip.dataset.team || 'all';
        filters.querySelectorAll('.weavers-filter-chip').forEach((button) => {
          button.classList.toggle('is-active', button.dataset.team === _activeTeam);
        });
        applySearchFilter();
      });
    }
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

    const data = await loadSectionData();
    _allVolunteers = data.volunteers;
    _visibleVolunteers = data.volunteers;
    _allGroups = data.groups;

    renderPage({
      volunteers: _allVolunteers,
      groups: _allGroups
    });

    bindSearch();
    registerServiceWorker().catch(() => {});
  }

  onReady(() => {
    initializePage().catch((error) => {
      console.error('[The Weavers] Failed to initialize section:', error);
      const root = document.getElementById('the-weavers-grid');
      if (!root) return;

      clearGrid(root);
      const fallback = document.createElement('article');
      fallback.className = 'broadsheet-card broadsheet-card--full';
      const message = document.createElement('div');
      message.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-state__icon';
      icon.textContent = '🧵';

      const title = document.createElement('p');
      title.className = 'empty-state__title';
      title.textContent = 'The Weavers could not load';

      const body = document.createElement('p');
      body.className = 'empty-state__message';
      body.textContent = 'Try again after the volunteer and group data connection is available.';

      message.appendChild(icon);
      message.appendChild(title);
      message.appendChild(body);
      fallback.appendChild(message);
      root.appendChild(fallback);
    });
  });
})();
