(function () {
  'use strict';

  const SECTION_KEY = 'the_calendar';
  const SECTION_TITLE = 'The Calendar';
  const AUTH_LEVEL = 0;
  const STORAGE_KEY = 'newspaper:the_calendar:cache';
  const SERVICE_WORKER_CANDIDATES = ['../../sw.js'];

  let _drawerBound = false;
  let _cachedData = null;
  let _activeMonthAnchor = new Date();

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
      pageRoot: document.getElementById('the-calendar-grid')
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

  function getText(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || '';
    }
    return String(value);
  }

  function parseDateValue(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function startOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = (day + 6) % 7;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - diff);
    return copy;
  }

  function endOfWeek(date) {
    const copy = startOfWeek(date);
    copy.setDate(copy.getDate() + 6);
    return copy;
  }

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatMonthHeading(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    });
  }

  function formatTime(value) {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    const text = String(value);
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });
    }

    return text;
  }

  function normalizeEvent(raw) {
    const dateText = getText(raw && (raw.date || raw.startDate || raw.startsOn || raw.when || raw.day), '');
    const startDate = parseDateValue(raw && (raw.startDate || raw.date || raw.startsOn || raw.when || raw.day));
    const endDate = parseDateValue(raw && (raw.endDate || raw.endsOn || raw.until));
    const title = getText(raw && (raw.title || raw.name || raw.subject), 'Untitled event');

    return {
      id: getText(raw && (raw.id || raw.eventId || raw._id), title + '|' + dateText),
      title,
      description: getText(raw && (raw.description || raw.summary || raw.body || raw.note), ''),
      location: getText(raw && (raw.location || raw.venue || raw.place || raw.room), ''),
      dateText,
      startDate,
      endDate,
      timeText: getText(raw && (raw.time || raw.startTime || raw.timeText), ''),
      endTimeText: getText(raw && (raw.endTime || raw.finishTime || raw.endText), ''),
      public: !!(raw && (raw.public || raw.isPublic || raw.visibility === 'public')),
      recurring: getText(raw && (raw.recurring || raw.repeat || raw.type), ''),
      rsvpCount: raw && raw.rsvpCount ? raw.rsvpCount : 0,
      raw: raw || {}
    };
  }

  function normalizeMember(raw) {
    const dobText = getText(raw && (raw.dob || raw.birthDate || raw.birthday), '');
    const dob = parseDateValue(dobText);
    return {
      id: getText(raw && (raw.id || raw.memberId || raw._id), getText(raw && raw.name, 'member')),
      name: getText(raw && (raw.name || raw.displayName || raw.fullName), 'Unnamed member'),
      role: getText(raw && (raw.role || raw.membershipRole || raw.memberRole), ''),
      household: getText(raw && (raw.household || raw.householdName || raw.family || raw.familyName), ''),
      status: getText(raw && (raw.membershipStatus || raw.status), 'member'),
      dob,
      dobText,
      contact: getText(raw && (raw.phone || raw.email || raw.contact), ''),
      milestones: raw && raw.milestones ? raw.milestones : [],
      raw: raw || {}
    };
  }

  function sortByDate(a, b) {
    const aTime = a && a.startDate ? a.startDate.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b && b.startDate ? b.startDate.getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
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

  async function fetchEventsLive() {
    const { vine, upperRoom } = getFlockApi();
    const tasks = [];

    if (vine && vine.events && typeof vine.events.list === 'function') {
      tasks.push(vine.events.list({ limit: 100 }));
    } else if (upperRoom && typeof upperRoom.listEvents === 'function') {
      tasks.push(upperRoom.listEvents({ limit: 100 }));
    }

    if (vine && vine.events && typeof vine.events.list === 'function' && vine.calendar && typeof vine.calendar.list === 'function') {
      tasks.push(vine.calendar.list({ limit: 100 }));
    } else if (upperRoom && typeof upperRoom.listCalendarEvents === 'function') {
      tasks.push(upperRoom.listCalendarEvents({ limit: 100 }));
    }

    if (upperRoom && typeof upperRoom.listMembers === 'function') {
      tasks.push(upperRoom.listMembers({ limit: 200 }));
    } else if (vine && vine.members && typeof vine.members.list === 'function') {
      tasks.push(vine.members.list({ limit: 200 }));
    }

    if (!tasks.length) {
      return null;
    }

    const settled = await Promise.allSettled(tasks);
    const eventRows = settled[0] && settled[0].status === 'fulfilled' ? extractRows(settled[0].value) : [];
    const calendarRows = settled[1] && settled[1].status === 'fulfilled' ? extractRows(settled[1].value) : [];
    const memberRows = settled[2] && settled[2].status === 'fulfilled' ? extractRows(settled[2].value) : [];

    return {
      events: eventRows.map(normalizeEvent),
      calendarEvents: calendarRows.map(normalizeEvent),
      members: memberRows.map(normalizeMember)
    };
  }

  function normalizeCachedData(data) {
    const events = Array.isArray(data && data.events) ? data.events.map(normalizeEvent) : [];
    const calendarEvents = Array.isArray(data && data.calendarEvents) ? data.calendarEvents.map(normalizeEvent) : [];
    const members = Array.isArray(data && data.members) ? data.members.map(normalizeMember) : [];
    return { events, calendarEvents, members };
  }

  async function loadData() {
    const live = await fetchEventsLive();
    if (live && (live.events.length || live.calendarEvents.length || live.members.length)) {
      writeCache(live);
      return live;
    }

    const cached = readCache();
    if (cached) {
      return normalizeCachedData(cached);
    }

    return { events: [], calendarEvents: [], members: [] };
  }

  function openDrawerWithNode(title, node) {
    const gates = getGates();
    if (typeof gates.openDrawer !== 'function') {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.appendChild(node);
    gates.openDrawer(title, wrapper.innerHTML);
  }

  function buildKicker(text) {
    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = text;
    return kicker;
  }

  function buildHeading(text, className) {
    const heading = document.createElement('h2');
    heading.className = className || 'story-hed';
    heading.textContent = text;
    return heading;
  }

  function buildSubhead(text, className) {
    const subhead = document.createElement('p');
    subhead.className = className || 'story-deck';
    subhead.textContent = text;
    return subhead;
  }

  function buildCard(title, subtitle, kickerText) {
    const article = document.createElement('article');
    article.className = 'broadsheet-card calendar-card';
    const header = document.createElement('header');
    header.className = 'card-header';

    header.appendChild(buildKicker(kickerText));
    header.appendChild(buildHeading(title, 'card-title'));
    header.appendChild(buildSubhead(subtitle, 'card-subtitle'));

    article.appendChild(header);
    return article;
  }

  function filterUpcomingEvents(events) {
    const now = new Date();
    return events
      .filter((event) => event && event.startDate && event.startDate.getTime() >= startOfWeek(now).getTime())
      .sort(sortByDate)
      .slice(0, 8);
  }

  function getEventDayKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }

  function buildEventRow(event) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entry-card calendar-event-row';
    button.dataset.eventId = event.id;

    const head = document.createElement('div');
    head.className = 'entry-card__head';

    const title = document.createElement('h3');
    title.textContent = event.title;
    head.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-card__meta';

    const when = document.createElement('span');
    when.className = 'entry-meta';
    when.textContent = event.startDate ? formatDate(event.startDate) : getText(event.dateText, 'TBD');
    meta.appendChild(when);

    if (event.timeText) {
      const time = document.createElement('span');
      time.className = 'entry-meta';
      time.textContent = formatTime(event.timeText);
      meta.appendChild(time);
    }

    if (event.location) {
      const location = document.createElement('span');
      location.className = 'entry-status';
      location.textContent = event.location;
      meta.appendChild(location);
    }

    if (event.public) {
      const badge = document.createElement('span');
      badge.className = 'entry-status';
      badge.textContent = 'Public';
      meta.appendChild(badge);
    }

    head.appendChild(meta);
    button.appendChild(head);

    if (event.description) {
      const summary = document.createElement('p');
      summary.className = 'entry-summary';
      summary.textContent = event.description;
      button.appendChild(summary);
    }

    return button;
  }

  function buildEventDrawer(event) {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-drawer';

    const kicker = document.createElement('p');
    kicker.className = 'story-kicker';
    kicker.textContent = event.public ? 'PUBLIC EVENT' : 'CALENDAR EVENT';
    wrap.appendChild(kicker);

    const title = document.createElement('h3');
    title.className = 'story-hed';
    title.textContent = event.title;
    wrap.appendChild(title);

    const deck = document.createElement('p');
    deck.className = 'story-deck';
    const bits = [];
    if (event.startDate) bits.push(formatDate(event.startDate));
    if (event.timeText) bits.push(formatTime(event.timeText));
    if (event.location) bits.push(event.location);
    deck.textContent = bits.join(' · ');
    wrap.appendChild(deck);

    if (event.description) {
      const body = document.createElement('p');
      body.className = 'story-body';
      body.textContent = event.description;
      wrap.appendChild(body);
    }

    const details = document.createElement('div');
    details.className = 'calendar-details';

    if (event.recurring) {
      const recurring = document.createElement('p');
      recurring.className = 'entry-meta';
      recurring.textContent = 'Recurring: ' + event.recurring;
      details.appendChild(recurring);
    }

    if (event.rsvpCount) {
      const rsvpCount = document.createElement('p');
      rsvpCount.className = 'entry-meta';
      rsvpCount.textContent = 'RSVPs: ' + String(event.rsvpCount);
      details.appendChild(rsvpCount);
    }

    wrap.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'calendar-actions';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'broadsheet-button';
    yesBtn.dataset.rsvpStatus = 'yes';
    yesBtn.dataset.eventId = event.id;
    yesBtn.textContent = 'I’m going';
    actions.appendChild(yesBtn);

    const maybeBtn = document.createElement('button');
    maybeBtn.type = 'button';
    maybeBtn.className = 'broadsheet-button broadsheet-button--ghost';
    maybeBtn.dataset.rsvpStatus = 'maybe';
    maybeBtn.dataset.eventId = event.id;
    maybeBtn.textContent = 'Maybe';
    actions.appendChild(maybeBtn);

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'broadsheet-button broadsheet-button--ghost';
    noBtn.dataset.rsvpStatus = 'no';
    noBtn.dataset.eventId = event.id;
    noBtn.textContent = 'Can’t make it';
    actions.appendChild(noBtn);

    wrap.appendChild(actions);

    return wrap;
  }

  async function submitRsvp(eventId, status) {
    const { vine, upperRoom } = getFlockApi();
    const payload = {
      eventId,
      response: status,
      status,
      rsvp: status
    };

    if (vine && vine.events && typeof vine.events.rsvp === 'function') {
      return vine.events.rsvp(payload);
    }

    if (upperRoom && typeof upperRoom.rsvpEvent === 'function') {
      return upperRoom.rsvpEvent(payload);
    }

    if (upperRoom && typeof upperRoom.eventsRsvp === 'function') {
      return upperRoom.eventsRsvp(payload);
    }

    return null;
  }

  function renderUpcomingCard(events) {
    const article = buildCard(
      'Upcoming Events',
      'Live church events from the Firestore-first calendar feed.',
      'THIS WEEK'
    );

    const list = document.createElement('div');
    list.className = 'entry-list';

    if (!events.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No upcoming events have been scheduled yet.';
      list.appendChild(empty);
    } else {
      events.forEach((event) => {
        list.appendChild(buildEventRow(event));
      });
    }

    article.appendChild(list);
    return article;
  }

  function renderBirthdaysCard(members) {
    const article = buildCard(
      'Birthdays This Week',
      'Members whose birthdays fall in the coming seven days.',
      'MEMBER CARE'
    );

    const list = document.createElement('div');
    list.className = 'entry-list';

    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const birthdays = members.filter((member) => member.dob && member.dob >= weekStart && member.dob <= weekEnd);

    if (!birthdays.length) {
      const empty = document.createElement('p');
      empty.className = 'drawer-empty';
      empty.textContent = 'No birthdays are coming up this week.';
      list.appendChild(empty);
    } else {
      birthdays.sort((a, b) => a.dob.getTime() - b.dob.getTime()).forEach((member) => {
        const row = document.createElement('article');
        row.className = 'entry-card';

        const head = document.createElement('div');
        head.className = 'entry-card__head';

        const title = document.createElement('h3');
        title.textContent = member.name;
        head.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'entry-card__meta';

        const dob = document.createElement('span');
        dob.className = 'entry-meta';
        dob.textContent = member.dob ? member.dob.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Birthday hidden';
        meta.appendChild(dob);

        if (member.household) {
          const household = document.createElement('span');
          household.className = 'entry-status';
          household.textContent = member.household;
          meta.appendChild(household);
        }

        head.appendChild(meta);
        row.appendChild(head);
        list.appendChild(row);
      });
    }

    article.appendChild(list);
    return article;
  }

  function buildMonthGrid(events) {
    const article = buildCard(
      formatMonthHeading(_activeMonthAnchor),
      'A simple month grid built from live calendar events.',
      'MONTH VIEW'
    );

    const monthGrid = document.createElement('div');
    monthGrid.className = 'calendar-month-grid';
    monthGrid.style.display = 'grid';
    monthGrid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
    monthGrid.style.gap = '0.35rem';

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    weekdayLabels.forEach((label) => {
      const head = document.createElement('div');
      head.className = 'calendar-month-grid__day';
      head.style.fontSize = '0.75rem';
      head.style.fontWeight = '700';
      head.style.textTransform = 'uppercase';
      head.style.letterSpacing = '0.08em';
      head.style.color = 'var(--ink-muted)';
      head.textContent = label;
      monthGrid.appendChild(head);
    });

    const monthStart = new Date(_activeMonthAnchor.getFullYear(), _activeMonthAnchor.getMonth(), 1);
    const monthEnd = new Date(_activeMonthAnchor.getFullYear(), _activeMonthAnchor.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart);
    const cells = [];
    const eventMap = new Map();

    events.forEach((event) => {
      const key = getEventDayKey(event.startDate);
      if (!key) return;
      if (!eventMap.has(key)) {
        eventMap.set(key, []);
      }
      eventMap.get(key).push(event);
    });

    const cursor = new Date(gridStart);
    while (cursor <= monthEnd || cursor.getDay() !== 1) {
      const cellDate = new Date(cursor);
      const key = getEventDayKey(cellDate);
      const cell = document.createElement('div');
      cell.className = 'calendar-month-grid__cell';
      cell.style.minHeight = '92px';
      cell.style.padding = '0.6rem';
      cell.style.border = '1px solid var(--rule)';
      cell.style.borderRadius = '0.75rem';
      cell.style.background = cellDate.getMonth() === _activeMonthAnchor.getMonth() ? 'var(--paper-card)' : 'var(--paper-sunken)';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.gap = '0.4rem';

      const dayNumber = document.createElement('div');
      dayNumber.className = 'calendar-month-grid__number';
      dayNumber.style.fontSize = '0.875rem';
      dayNumber.style.fontWeight = '700';
      dayNumber.style.color = 'var(--ink)';
      dayNumber.textContent = String(cellDate.getDate());
      cell.appendChild(dayNumber);

      const list = eventMap.get(key) || [];
      if (list.length) {
        const teaser = document.createElement('div');
        teaser.className = 'calendar-month-grid__events';
        teaser.style.display = 'flex';
        teaser.style.flexDirection = 'column';
        teaser.style.gap = '0.25rem';

        list.slice(0, 2).forEach((event) => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'calendar-day-chip';
          chip.style.border = '1px solid var(--rule)';
          chip.style.borderRadius = '999px';
          chip.style.padding = '0.35rem 0.55rem';
          chip.style.fontSize = '0.75rem';
          chip.style.fontWeight = '700';
          chip.style.textAlign = 'left';
          chip.style.background = event.public ? 'var(--success-soft)' : 'var(--paper-sunken)';
          chip.textContent = event.title;
          chip.addEventListener('click', () => openEvent(event));
          teaser.appendChild(chip);
        });

        if (list.length > 2) {
          const more = document.createElement('span');
          more.className = 'entry-meta';
          more.textContent = '+' + String(list.length - 2) + ' more';
          teaser.appendChild(more);
        }

        cell.appendChild(teaser);
      }

      monthGrid.appendChild(cell);

      cells.push(cell);
      cursor.setDate(cursor.getDate() + 1);
      if (cells.length > 60) {
        break;
      }
    }

    article.appendChild(monthGrid);
    return article;
  }

  function openEvent(event) {
    const drawer = buildEventDrawer(event);
    openDrawerWithNode(event.title, drawer);
  }

  function bindDrawerEvents() {
    if (_drawerBound) return;

    const body = document.getElementById('drawer-body');
    if (!body) return;

    body.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-rsvp-status]');
      if (!button) return;

      const eventId = button.getAttribute('data-event-id');
      const status = button.getAttribute('data-rsvp-status');

      try {
        await submitRsvp(eventId, status);
        const gates = getGates();
        if (typeof gates.showToast === 'function') {
          gates.showToast('RSVP sent');
        }
      } catch (error) {
        console.warn('[The Calendar] RSVP failed:', error);
        const gates = getGates();
        if (typeof gates.showToast === 'function') {
          gates.showToast('Could not send RSVP');
        }
      }
    });

    _drawerBound = true;
  }

  function clearGrid(root) {
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
  }

  function renderPage(data) {
    const root = document.getElementById('the-calendar-grid');
    if (!root) return;

    clearGrid(root);

    const upcoming = filterUpcomingEvents(data.events.slice());
    const combinedEvents = data.calendarEvents.length ? data.calendarEvents.slice() : data.events.slice();

    root.appendChild(renderUpcomingCard(upcoming));
    root.appendChild(buildMonthGrid(combinedEvents));
    root.appendChild(renderBirthdaysCard(data.members));

    if (!upcoming.length && !combinedEvents.length && !data.members.length) {
      const empty = document.createElement('article');
      empty.className = 'broadsheet-card broadsheet-card--full';
      const message = document.createElement('div');
      message.className = 'empty-state';

      const icon = document.createElement('div');
      icon.className = 'empty-state__icon';
      icon.textContent = '📅';

      const title = document.createElement('p');
      title.className = 'empty-state__title';
      title.textContent = 'The Calendar is waiting for its first event';

      const body = document.createElement('p');
      body.className = 'empty-state__message';
      body.textContent = 'When events are published, they will appear here with RSVP actions and monthly context.';

      message.appendChild(icon);
      message.appendChild(title);
      message.appendChild(body);
      empty.appendChild(message);
      root.appendChild(empty);
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

    const data = await loadData();
    _cachedData = data;
    renderPage(data);

    registerServiceWorker().catch(() => {});
  }

  onReady(() => {
    initializePage().catch((error) => {
      console.error('[The Calendar] Failed to initialize section:', error);
      const root = document.getElementById('the-calendar-grid');
      if (root) {
        clearGrid(root);
        const fallback = document.createElement('article');
        fallback.className = 'broadsheet-card broadsheet-card--full';
        const message = document.createElement('div');
        message.className = 'empty-state';

        const icon = document.createElement('div');
        icon.className = 'empty-state__icon';
        icon.textContent = '📅';

        const title = document.createElement('p');
        title.className = 'empty-state__title';
        title.textContent = 'The Calendar could not load';

        const body = document.createElement('p');
        body.className = 'empty-state__message';
        body.textContent = 'Try again after the live data connection is available.';

        message.appendChild(icon);
        message.appendChild(title);
        message.appendChild(body);
        fallback.appendChild(message);
        root.appendChild(fallback);
      }
    });
  });
})();
