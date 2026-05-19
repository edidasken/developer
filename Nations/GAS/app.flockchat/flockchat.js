/* ══════════════════════════════════════════════════════════════════════════
   FLOCKCHAT V3 — iMessage for Church
   "How good and pleasant it is when God's people live together in unity!"
   — Psalm 133:1

   Philosophy: Radical simplicity. One unified conversation list. Beautiful
   bubbles. Push notifications. No complexity.

   Data Structure:
     conversations/{cid}
       ├── type: 'dm' | 'group' | 'prayer' | 'announcement'
       ├── name, icon, participants[], lastMessage{}, lastActivity, unreadCount
       └── messages/{mid} → { text, author, timestamp, type }

   Features:
     ✓ Unified conversation list (no tabs!)
     ✓ iMessage-style bubbles
     ✓ Real-time updates
     ✓ Push notifications (FCM)
     ✓ Mobile + desktop responsive
     ✓ Auto-scroll to latest
     ✓ Typing indicators (future)

   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

(function() {

  /* ── Constants ─────────────────────────────────────────────────────── */
  const VERSION = 'v3.0.0';
  const MSG_LIMIT = 100;
  const ANNOUNCEMENTS_ID   = 'announcements';
  const MENS_MINISTRY_ID   = 'mens-ministry';
  const WOMENS_MINISTRY_ID = 'womens-ministry';

  // All-member group channels — displayed to every authenticated member,
  // visible to Lead Pastor + admins by default. Order here = display order.
  const ALL_MEMBER_GROUPS = [
    { id: 'servant-team',  type: 'servant-team',  name: 'Servant Team',  welcome: 'Servant Team (Deacons) channel.' },
    { id: 'worship-team',  type: 'worship-team',  name: 'Worship Team',  welcome: 'Worship Team coordination channel.' },
    { id: 'missions-team', type: 'missions-team', name: 'Missions Team', welcome: 'Missions Team channel.' },
    { id: 'church-life',   type: 'church-life',   name: 'Church Life',   welcome: 'Church Life & fellowship channel.' },
    { id: 'stewardship',   type: 'stewardship',   name: 'Stewardship',   welcome: 'Stewardship & giving channel.' },
    { id: 'outreach',      type: 'outreach',      name: 'Outreach',      welcome: 'Outreach & evangelism channel. Outreach contacts arrive here.' },
  ];
  // Info / guide pinned channels (read-only, no Firestore doc)
  const INFO_FLOCKCHAT_ID = 'info-flockchat';
  const INFO_FLOCKOS_ID   = 'info-flockos';
  const INFO_IDS = new Set([INFO_FLOCKCHAT_ID, INFO_FLOCKOS_ID]);

  // Personal sanctuary channel (journal, prayers, devotional, reading)
  const SANCTUARY_ID = 'my-sanctuary';

  // Recent Sermons feed channel
  const SERMONS_ID = 'recent-sermons';

  // FlockNews feed channel (last 7 days)
  const FLOCKNEWS_ID = 'flocknews';

  // Quick-lookup Set of all static group IDs (includes info + sanctuary + news)
  const ALL_GROUP_IDS = new Set([
    ANNOUNCEMENTS_ID, MENS_MINISTRY_ID, WOMENS_MINISTRY_ID,
    INFO_FLOCKCHAT_ID, INFO_FLOCKOS_ID, SANCTUARY_ID, SERMONS_ID, FLOCKNEWS_ID,
    ...ALL_MEMBER_GROUPS.map(g => g.id)
  ]);

  /* ── State ─────────────────────────────────────────────────────────── */
  let _db = null;
  let _messaging = null;
  let _me = null;
  let _conversations = [];
  let _activeConvId = null;
  let _messages = [];
  let _convUnsub = null;
  let _msgUnsub = null;
  let _showArchived = false;
  let _openMenuConvId = null;
  let _sanctuaryTab = 'journal'; // active tab inside personal sanctuary hub
  // Church / member context (resolved during boot)
  let _myGender      = '';    // 'Male' | 'Female' | '' — from member doc
  let _meIsAllAccess = false; // Lead Pastor / admin — sees all pinned groups
  let _pastorUid     = null;  // Firebase UID of Lead Pastor
  // Ministry channel doc listeners
  let _mensDocUnsub     = null;
  let _womensDocUnsub   = null;
  let _mensLastSnippet  = '';
  let _mensLastAt       = null;
  let _womensLastSnippet = '';
  let _womensLastAt      = null;
  // Generic group channel state: id → { snippet, lastAt, unsub }
  const _grpState = {};
  ALL_MEMBER_GROUPS.forEach(g => { _grpState[g.id] = { snippet: '', lastAt: null, unsub: null }; });

  /* ── Info Channel Content (static, read-only) ───────────────────────── */
  const _INFO_DATA = Object.freeze({
    'info-flockchat': {
      msgs: [
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>',
          title: 'What is FlockChat?',
          preview: 'Your church\'s dedicated real-time communication hub — built directly into FlockOS.',
          body: '<p>FlockChat is the communication layer of FlockOS — a purpose-built messaging platform designed exclusively for churches. Unlike general-purpose chat apps, FlockChat is woven directly into your church\'s member database, enabling pastors and leadership to communicate with the right people, in the right channels, at exactly the right time.</p><p>Every message, prayer request, and announcement is stored securely in your church\'s private Firebase project — not on a third-party server, not shared with advertisers, not subject to platform shutdowns. Your church owns the data, full stop.</p><p>FlockChat operates as a Progressive Web App (PWA), meaning it works on every device — iPhone, Android, desktop, tablet — without requiring an app store download. Members simply visit your church\'s FlockOS URL and it installs natively.</p><ul><li><strong>Real-time:</strong> Messages arrive instantly via Firebase Firestore live listeners — no polling, no refresh.</li><li><strong>Role-aware:</strong> Channels appear or disappear based on gender, role, and membership status pulled directly from The Fold.</li><li><strong>Admin-controlled:</strong> The Lead Pastor and admins have full moderation capability — delete messages, manage members, switch channels between Open and Private.</li><li><strong>Zero friction:</strong> Members who already use FlockOS are automatically in FlockChat. No separate login, no extra signup.</li></ul>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
          title: 'Channel Types',
          preview: 'Every channel has a purpose — from church-wide announcements to private pastoral conversations.',
          body: '<p>FlockChat organizes communication into purpose-built channels, each designed for a specific ministry context. Here is a complete guide to every channel type:</p><ul><li><strong>📢 Church Announcements:</strong> Church-wide broadcast channel. Only the pastor and admins can post here. Members read and stay informed. This channel is always pinned to the top for every authenticated member.</li><li><strong>🙏 Prayer Chain:</strong> Any member can submit a prayer request, which becomes visible to the entire church. Requests are ordered from newest to oldest. This replaces the printed prayer list and the email chain.</li><li><strong>✉️ Message the Pastor:</strong> A private, one-on-one channel between an individual member and the Lead Pastor. The member sees only their own thread. The pastor sees all pastoral threads in one view. Confidential and secure.</li><li><strong>⚓ Men\'s Ministry:</strong> Visible only to male members and pastoral staff. Gender is read from The Fold member database — it cannot be spoofed.</li><li><strong>🌸 Women\'s Ministry:</strong> Visible only to female members and pastoral staff. Same gender-gating logic as Men\'s Ministry.</li><li><strong>🛡 Servant Team:</strong> For deacons, board members, and service volunteers. Supports Open and Private access modes.</li><li><strong>🎵 Worship Team:</strong> For musicians, vocalists, and sound technicians. Coordinate set lists, rehearsal schedules, and production details here.</li><li><strong>🌍 Missions Team:</strong> For the missions committee and global partners. Share updates, prayer points, and trip logistics.</li><li><strong>❤️ Church Life:</strong> General fellowship channel — events, celebrations, social connection.</li><li><strong>🔑 Stewardship:</strong> For finance committee and giving-related communication. Supports Private mode so sensitive discussions stay contained.</li><li><strong>👥 Outreach:</strong> For evangelism teams and guest-follow-up coordination. Outreach contacts can surface here from the Invite module.</li></ul>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
          title: 'Prayer Chain',
          preview: 'Posts become shared church prayer requests — visible to every authenticated member.',
          body: '<p>The Prayer Chain is one of the most spiritually significant features of FlockChat. It replaces the paper prayer list, the group text, and the weekly bulletin prayer section — and makes every request available to the whole church the moment it is submitted.</p><h3>How It Works</h3><p>Any authenticated church member can post a prayer request directly into the Prayer Chain channel. Their message becomes immediately visible to every member who has FlockOS open or who receives a push notification. The channel is ordered chronologically — newest requests appear at the top.</p><h3>For Pastors &amp; Admins</h3><p>The pastor and admins can delete any request (for pastoral sensitivity or accidental duplicate posts) using the trash icon that appears when hovering or long-pressing a message. This is only visible to admin accounts.</p><h3>Push Notifications</h3><p>Members who have granted notification permissions receive a push alert when a new prayer request is posted. This turns the entire congregation into an intercessory network — a need submitted at 2am reaches people who are already awake and praying.</p><h3>Pastoral Tip</h3><p>Encourage members to treat the Prayer Chain as sacred space — real requests, real needs. Consider posting a weekly pastoral prayer to model how it should be used and to keep the channel spiritually anchored.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
          title: 'Direct Messages',
          preview: 'Private one-on-one conversations with any member in The Fold who has activated FlockChat.',
          body: '<p>Direct Messages (DMs) allow any two members to have a private conversation within FlockChat. DMs are completely separate from channel-based communication — they are visible only to the two participants.</p><h3>Starting a DM</h3><p>Tap the compose icon (pencil) at the top of the FlockChat conversation list. A search drawer slides up showing all members from The Fold who have activated their FlockChat account. Search by name or member PIN, select the person, and tap to open the thread.</p><h3>SMS Fallback</h3><p>If a member is in The Fold but has not yet activated FlockChat, you can still reach them via SMS. The compose drawer shows an SMS option for members who have a phone number on file. Tapping it opens your device\'s native messaging app pre-populated with their number — no copy-paste required.</p><h3>Pastoral DMs (Message the Pastor)</h3><p>The "Message the Pastor" pinned channel gives every member a private line to the Lead Pastor that bypasses the general DM system. These messages are elevated in the UI and never mixed with general conversations. The pastor sees all pastoral message threads organized in one place.</p><h3>Archiving &amp; Deleting</h3><p>Members can archive or delete a DM thread from their own view without affecting the other participant\'s copy. Archived threads can be shown or hidden with the toggle at the top of the conversation list.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
          title: 'Group Channels',
          preview: 'Six purpose-built group channels with Open/Private access control for leadership teams.',
          body: '<p>FlockChat includes six pre-built group channels designed around the most common ministry team structures in a local church. Each channel supports full access control, message moderation, and member management from the Channel Manager.</p><h3>The Six Group Channels</h3><ul><li><strong>Servant Team</strong> — For deacons and service volunteers. The shield icon reflects their role as protectors and servants of the congregation.</li><li><strong>Worship Team</strong> — Musicians, vocalists, audio/visual crew. Coordinate set lists, rehearsal notes, and technical details. Works alongside FlockStand in the broader FlockOS ecosystem.</li><li><strong>Missions Team</strong> — Global and local missions partners, committee members, and trip participants. Share field reports, prayer updates, and financial transparency.</li><li><strong>Church Life</strong> — Fellowship, events, and community life. The open channel for celebrating milestones, coordinating small groups, and keeping people connected between Sundays.</li><li><strong>Stewardship</strong> — Finance committee, giving campaigns, and budget discussions. Best used in Private mode to protect sensitive financial conversations.</li><li><strong>Outreach</strong> — Evangelism teams, door-to-door coordination, and guest follow-up. Designed to interface with the Invite module when new guests are tracked through FlockOS.</li></ul><h3>Access Control</h3><p>Every group channel supports two access modes:</p><ul><li><strong>Open:</strong> All authenticated church members can see the channel. It appears in every member\'s pinned grid automatically.</li><li><strong>Private:</strong> Only members explicitly added by the pastor or admin can see the channel. Non-members don\'t see it at all — it simply doesn\'t appear in their list.</li></ul><p>Access mode is changed instantly from the Channel Manager drawer. Switching from Open to Private immediately hides the channel from non-members across all devices, in real time, without a page reload.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
          title: 'Channel Manager',
          preview: 'Admins can set Open/Private, add members from The Fold, remove members, and delete messages.',
          body: '<p>The Channel Manager is the administrative control panel for every group channel. It is accessible only to the Lead Pastor and members with an admin role. To open it, navigate to any group channel and tap the gear icon (⚙️) in the top-right corner of the thread header.</p><h3>Access Mode Toggle</h3><p>At the top of the manager, two buttons let you instantly switch the channel between:</p><ul><li><strong>🌐 Open:</strong> Visible to all church members. Anyone who logs into FlockOS will see this channel in their pinned grid.</li><li><strong>🔒 Private:</strong> Visible only to members you have explicitly added. The channel is invisible to everyone else. When switched to Private with an empty members list, the channel is effectively hidden from all non-admin users until you add someone.</li></ul><h3>Current Members</h3><p>This section lists every member who has been explicitly added to the channel (when in Private mode). Each entry shows the member\'s name and member PIN. A Remove button instantly pulls them from the channel.</p><h3>Add Members</h3><p>The add-members section displays every member from The Fold who has an active FlockOS account, sorted alphabetically. Use the search bar to filter by name, email, or PIN. Check as many members as you need — the Add button updates in real time to show the count ("Add 4 Members"). Tap the button to add them all at once via a single Firestore write.</p><h3>Removed / Banned</h3><p>Members who have been explicitly removed appear in the Removed/Banned section. Each can be restored with one tap, re-granting them access to the channel immediately.</p><h3>Message Moderation</h3><p>Admins can delete any message from any member in any channel. Hover or long-press a message to reveal the trash icon (🗑). A confirmation prompt prevents accidental deletions. Deleted messages are removed from Firestore and disappear from all devices immediately.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
          title: 'Real-Time Sync',
          preview: 'Every message arrives instantly across all devices via Firebase Firestore live listeners.',
          body: '<p>FlockChat is built on Google Firebase Firestore, a real-time NoSQL cloud database. Rather than polling a server on a timer, Firestore maintains a persistent live connection to every client. When any message, prayer request, or announcement is written to the database, every connected device receives the update within milliseconds — without refreshing the page.</p><h3>How It Works</h3><p>When you open FlockChat, the app establishes real-time listeners (called "snapshots") on:</p><ul><li>Your active conversation\'s messages subcollection</li><li>All pinned channel docs (for snippet previews and unread counts)</li><li>Your personal conversations list</li></ul><p>Any write from any device triggers these listeners simultaneously. If a member posts in the Prayer Chain from their phone, every other member with FlockChat open sees the message appear — with the sender\'s name and timestamp — without touching their screen.</p><h3>Offline Behavior</h3><p>Firestore has built-in offline persistence. If a member loses internet connection, previously loaded messages remain readable. When connectivity restores, the app automatically syncs any missed messages and re-establishes all live listeners. The user does not need to reload the page.</p><h3>Performance</h3><p>FlockChat loads the 100 most recent messages per conversation. Older messages are accessible by scrolling. This keeps the initial load fast even for active channels with years of history.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
          title: 'The Fold Integration',
          preview: 'FlockChat draws its member list, roles, and permissions directly from your church\'s member database.',
          body: '<p>The Fold is FlockOS\'s master member database — the single source of truth for every person in your congregation. FlockChat does not maintain a separate user list. Instead, it reads directly from The Fold for all membership data, ensuring that what you see in FlockChat is always consistent with what is in the church database.</p><h3>Member PINs</h3><p>Every member in The Fold is assigned a unique member PIN (the Firestore document ID). This PIN is the authoritative identifier for each person across all FlockOS modules. In the Channel Manager, members are displayed with their PIN so admins can unambiguously identify who they are adding or removing — regardless of whether they have a common name.</p><h3>Role-Based Access</h3><p>FlockChat reads the <code>role</code> and <code>memberType</code> fields from each member\'s Fold document to determine access levels:</p><ul><li><strong>Lead Pastor / Admin:</strong> Full access to all channels, the Channel Manager, message deletion, and the admin compose bar for Announcements and Prayer Chain.</li><li><strong>Male Members:</strong> See Men\'s Ministry in their pinned grid.</li><li><strong>Female Members:</strong> See Women\'s Ministry in their pinned grid.</li><li><strong>All Members:</strong> See Announcements, Prayer Chain, Church Life, and any Open group channels.</li></ul><h3>Gender Gating</h3><p>The gender field from The Fold is read at login and stored locally in the session. Men\'s Ministry and Women\'s Ministry channels are conditionally injected based on this value — it cannot be overridden by the user, and it is not stored in the auth token. The church controls who is classified as which gender through the member database.</p><h3>flockchatActive Flag</h3><p>When a member first logs into FlockChat, the system writes a <code>flockchatActive: true</code> flag back to their Fold member document. This flag is used by the DM search and the Channel Manager member picker to surface only members who have actually activated their FlockChat account — keeping the member list clean and actionable.</p>'
        }
      ]
    },
    'info-flockos': {
      msgs: [
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
          title: 'What is FlockOS?',
          preview: 'The church\'s operating system — every ministry tool your congregation needs, in one platform.',
          body: '<p>FlockOS is a Progressive Web App (PWA) built specifically for local churches. It is not a generic app platform adapted for ministry — it was designed from the ground up around how pastors actually lead, how churches actually operate, and what administration actually steals from ministry time.</p><p>The core insight behind FlockOS is simple: most church software exists to manage churches, not to serve pastors. The result is platforms that generate more admin work than they eliminate. FlockOS inverts this — every feature is designed to reduce friction, automate the repeatable, and give the pastor back hours that can be spent with people.</p><h3>One Platform, Every Ministry Layer</h3><p>FlockOS bundles communication, worship, media, discipleship, content, prayer, outreach, and member management into a single PWA that installs on any device. Members do not juggle five apps. Pastors do not maintain five platforms. There is one URL, one login, one experience.</p><h3>How It\'s Structured</h3><p>FlockOS is built on a hub-and-spoke model. The Fold (member database) sits at the center. Every app — FlockChat, FlockStand, FlockShow, GROW, FEED, Wellspring, and Invite — reads from and writes back to The Fold. Data entered in one module is immediately available in others. A new member registered through Invite shows up in FlockChat the same day. A discipleship milestone logged in GROW triggers a follow-up in Wellspring. The apps do not operate in silos.</p><h3>Deployment</h3><p>FlockOS is deployed through GitHub Pages and Firebase Hosting. Each church has its own branded deployment — its own domain, its own colors, its own Firebase database. No church\'s data touches another church\'s infrastructure. The church pastor and designated admins have full control over their environment.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
          title: 'FlockChat — Communication',
          preview: 'Real-time church messaging with channels, direct messages, prayer requests, and admin moderation.',
          body: '<p>FlockChat is the communication backbone of FlockOS. It replaces group texts, email chains, bulletin boards, and disconnected messaging apps with a single, purpose-built communication platform that is aware of your church\'s structure, roles, and membership.</p><p>Channels are organized by ministry function — not by general topic. The Prayer Chain is for prayer. The Worship Team channel is for worship coordination. Message the Pastor gives every member a private pastoral line. This structure eliminates the noise of general-purpose channels while ensuring every conversation has a home.</p><p>Everything described in the FlockChat guide (tap the FlockChat pin in your channel list) applies here. The key integration points with the rest of FlockOS are:</p><ul><li><strong>The Fold:</strong> Member list, roles, PINs, and gender-gating all come from the member database. FlockChat never maintains its own user directory.</li><li><strong>Invite:</strong> When a new guest is registered through the Invite module, the outreach team can be notified via the Outreach channel in FlockChat.</li><li><strong>GROW:</strong> Discipleship milestones and follow-up tasks can prompt a pastoral DM to the member from the GROW module.</li><li><strong>Wellspring:</strong> Prayer requests submitted through Wellspring\'s prayer hour feature can be surfaced in the Prayer Chain.</li></ul>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
          title: 'FlockStand — Worship & SongSelect',
          preview: 'Plan worship sets, search CCLI SongSelect, and display lyrics on any screen — from your phone.',
          body: '<p>FlockStand is the worship team management module of FlockOS. It handles every phase of Sunday morning music — from song discovery and set planning through to live lyric display during the service.</p><h3>Song Library</h3><p>FlockStand maintains a church song library stored in Firestore. Songs are added once and available to every worship leader from any device. The library stores lyrics, CCLI numbers, keys, tempo, and notes. All content is private to your church — there is no shared public database of songs that could be edited by others.</p><h3>CCLI SongSelect Integration</h3><p>FlockStand connects directly to CCLI SongSelect, giving worship leaders access to the world\'s largest licensed worship song database. Search by title, artist, or scripture reference. Import lyrics directly into your church library with one tap. CCLI license tracking is handled automatically — no manual log required.</p><h3>Set Planning</h3><p>Build and save worship sets for upcoming services. Drag to reorder. Mark songs as opening, worship, response, or closing. Sets are saved to Firestore and visible to every team member who has FlockStand access, from any device, in real time.</p><h3>Live Display</h3><p>During the service, FlockStand drives the lyric display. The worship leader\'s phone controls what is shown on the main screen — advance slides, jump to a chorus, trigger a blank screen between songs. No laptop required at the front of the stage. No wired clicker needed. The leader\'s phone is the controller.</p><h3>The Fold Connection</h3><p>FlockStand respects the same role-based access as the rest of FlockOS. Only members with worship team roles in The Fold can edit sets or control the live display. Other members can view the set but not modify it — protecting the flow of the service from accidental changes.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
          title: 'FlockShow — Media Display',
          preview: 'Sermon slides, announcements, and media — controlled from the pastor\'s phone, displayed on any screen.',
          body: '<p>FlockShow is the media and presentation module of FlockOS. It handles everything shown on your church\'s screens that is not a worship lyric — sermon slides, scripture, announcements, countdowns, and media backgrounds.</p><h3>What It Replaces</h3><p>FlockShow replaces PowerPoint, ProPresenter, and the laptop-at-the-front-of-the-stage workflow. Presentations are built in the FlockOS interface and stored in Firestore. They render in the browser on any connected screen — a TV, a projector, a secondary monitor — with no software installation required on the display device.</p><h3>Pastor-Controlled</h3><p>The design philosophy of FlockShow is that the pastor should control what is on the screen, not the tech volunteer. The pastor\'s phone is the remote. Tap to advance a slide, tap to return, tap to blank the screen. The pastor never has to make eye contact with a volunteer at the back of the room to signal "next slide."</p><h3>Sermon Integration</h3><p>When a sermon series is set up in FlockOS, FlockShow automatically pulls the series title, scripture, and key points into a presentation template. The pastor edits the outline in FlockOS and the slides update automatically — no copy-paste between platforms, no version mismatch between the outline and the display.</p><h3>Announcement Loop</h3><p>Between services, FlockShow runs an announcement loop pulling from the same content posted in the Church Announcements channel in FlockChat. One post creates both the chat notification and the on-screen graphic. The pastor posts once; it appears everywhere.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
          title: 'GROW — Discipleship Tracking',
          preview: 'Track spiritual milestones, assign follow-up, and measure discipleship growth across your congregation.',
          body: '<p>GROW is the discipleship tracking module of FlockOS. It replaces the spreadsheet-in-a-shared-folder, the sticky note on the pastor\'s desk, and the conversation that falls through the cracks because no one wrote it down.</p><h3>Spiritual Milestones</h3><p>GROW tracks the key milestones in a member\'s spiritual journey:</p><ul><li>First visit / guest registration</li><li>Salvation decision</li><li>Baptism</li><li>Church membership</li><li>Small group involvement</li><li>Serving on a ministry team</li><li>Leadership development</li></ul><p>Each milestone is logged against the member\'s Fold record with a date and optional pastoral notes. The full history is visible to the pastor and designated discipleship leaders at any time.</p><h3>Follow-Up Assignment</h3><p>When a milestone is logged (a guest visits, someone makes a decision, a new member joins), GROW automatically generates a follow-up task. That task can be assigned to the pastor, a deacon, or a care team member. The assigned person receives a notification in FlockOS and the task appears in their GROW dashboard.</p><h3>The Pipeline View</h3><p>GROW includes a pipeline view — a visual representation of where every active member or guest sits in the discipleship journey. The pastor can see at a glance who has been a guest for three Sundays without a follow-up, who was baptized but never connected to a small group, and who is ready for a leadership conversation. This view turns pastoral intuition into actionable data.</p><h3>Time Saved</h3><p>Before GROW, tracking discipleship meant checking multiple spreadsheets, calling staff to ask "did someone follow up with that family?", and relying on human memory for who needs what. GROW eliminates all of that and replaces it with a single view, automated task generation, and a complete audit trail.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
          title: 'FEED — Content & Devotionals',
          preview: 'Daily devotionals, sermon resources, and a content calendar — delivered to every member\'s FlockOS home.',
          body: '<p>FEED is the content distribution module of FlockOS. It handles the creation and delivery of devotionals, sermon follow-up content, and church resources to every member\'s FlockOS home screen.</p><h3>Daily Devotionals</h3><p>The pastor or a designated content leader writes and schedules devotionals through the FEED editor. Devotionals can be tied to the current sermon series, the church calendar, or the liturgical calendar. Members see today\'s devotional on their FEED tab every day — no email required, no link to click, no app notification to dismiss.</p><h3>Sermon Follow-Up</h3><p>After each service, the week\'s sermon can be linked to a FEED card that includes the scripture passage, the key points, a reflection question, and a prayer prompt. Members who missed the service can catch up. Members who attended can go deeper. Both groups are served by the same piece of content.</p><h3>Content Calendar</h3><p>FEED includes a simple content calendar that shows the pastor what is scheduled for the coming weeks. This replaces the "what are we sending out this week?" conversation in staff meetings. The calendar is live — items can be added, edited, or removed at any time.</p><h3>Resource Library</h3><p>Beyond daily content, FEED can host a resource library — downloadable PDFs, study guides, recommended books, and links to external resources. All resources are organized by topic and searchable by members. The library is managed entirely within FlockOS.</p><h3>The Fold Connection</h3><p>FEED content can be targeted by membership status, small group, or ministry team role. A devotional written for the Servant Team can be published only to that group. A new member welcome resource can be sent only to members who joined in the last 30 days.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
          title: 'Wellspring — Prayer',
          preview: 'Prayer request management, intercessory prayer lists, and scheduled prayer hours for your congregation.',
          body: '<p>Wellspring is the prayer module of FlockOS. It goes deeper than the Prayer Chain in FlockChat — while FlockChat\'s Prayer Chain is for real-time, community-visible requests, Wellspring handles the pastoral and structural side of the church\'s prayer life.</p><h3>Prayer Request Management</h3><p>Wellspring gives the pastor a full view of every prayer request submitted across the church — from FlockChat, from Wellspring\'s own submission form, and from pastoral visits logged in GROW. Requests can be organized by category (healing, provision, salvation, relationship, protection) and assigned to prayer team members.</p><h3>Intercessory Prayer Lists</h3><p>The prayer team can access a curated list of active requests — without seeing the full member database or private pastoral notes. Each intercessor sees only what the pastor has approved for distribution. When a request is answered or resolved, it is marked as such, and the intercessor receives a praise report automatically.</p><h3>Prayer Hours</h3><p>Wellspring supports scheduled prayer hours — dedicated times when members commit to interceding for the church\'s current prayer list. The pastor sets a prayer hour schedule, members sign up, and Wellspring sends reminders at the right time. During a prayer hour, members can log their prayer session, adding to the visible record of how many people are actively interceding.</p><h3>The Fold Connection</h3><p>Prayer requests submitted for specific members are linked to their Fold record. The pastor can see a member\'s full prayer history — every request they have submitted and every request that has been prayed for them — as part of their pastoral profile. This context is invaluable for pastoral care conversations.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>',
          title: 'Invite — Guest & Outreach',
          preview: 'Digital invitations, guest registration, and first-time visitor follow-up — integrated with The Fold.',
          body: '<p>Invite is the outreach and guest management module of FlockOS. It handles the full lifecycle of a new person\'s journey with your church — from the moment a member invites a friend to the moment that guest becomes a member.</p><h3>Digital Invitations</h3><p>Any church member can generate a personal invitation link from the Invite module. The link is branded with the church\'s logo and the member\'s name — "John Smith invites you to visit Grace Church." When the guest opens the link, they see service times, the church address, a welcome message from the pastor, and a form to let the church know they\'re coming.</p><h3>Guest Registration</h3><p>When a first-time guest arrives, staff or volunteers register them through the Invite module on a tablet or phone. The registration form captures name, contact information, how they heard about the church, and whether they want follow-up. This data flows directly into The Fold — the guest is added as a record immediately, and a GROW follow-up task is created automatically.</p><h3>Automated Follow-Up</h3><p>Invite supports a configurable follow-up sequence for new guests:</p><ul><li><strong>Same day:</strong> A FlockChat message or push notification to the outreach team alerting them to the new guest.</li><li><strong>3 days:</strong> A personal follow-up prompt assigned to the pastor or care team member.</li><li><strong>1 week:</strong> A check-in prompt to see if the guest has returned.</li></ul><p>Each step is logged in GROW so nothing falls through the cracks.</p><h3>Invitation Analytics</h3><p>The Invite dashboard shows how many invitations have been sent, how many resulted in a guest visit, and which members are actively inviting. This data helps the pastor celebrate outreach wins and identify where the church\'s relational network is strongest.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><line x1="12" y1="8" x2="12" y2="16"/></svg>',
          title: 'The Fold — Member Database',
          preview: 'Your church\'s master member database — the source of truth for every FlockOS app.',
          body: '<p>The Fold is the foundation of FlockOS. Every other module — FlockChat, GROW, Wellspring, Invite, FlockStand, FEED — draws its data from The Fold. It is the single source of truth for who your members are, what their roles are, and what their history with your church looks like.</p><h3>What The Fold Stores</h3><p>Each member record in The Fold includes:</p><ul><li><strong>Identity:</strong> First name, last name, display name, member PIN</li><li><strong>Contact:</strong> Primary email, secondary email, primary phone, address</li><li><strong>Membership:</strong> Membership status (active, inactive, archived), join date, membership class completion</li><li><strong>Role:</strong> Member, deacon, elder, admin, worship team, missions team, etc.</li><li><strong>Gender:</strong> Used for Men\'s/Women\'s Ministry access control in FlockChat</li><li><strong>Discipleship:</strong> Saved, baptized, small group involvement, serving role — linked to GROW</li><li><strong>FlockOS Activity:</strong> flockchatActive flag, last seen timestamp, FCM push token for notifications</li></ul><h3>PINs</h3><p>Every member has a unique PIN — this is the Firestore document ID for their record. PINs are used throughout FlockOS to identify members unambiguously across modules. The Channel Manager shows PINs so admins can identify members even when names are common. The Lead Pastor is configured by their PIN in the church settings.</p><h3>Security</h3><p>The Fold is protected by Firestore Security Rules. Members can read their own record. Admins can read and write all records. No member can access another member\'s private data. All writes are server-validated — client-side code cannot escalate its own permissions.</p>'
        },
        {
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
          title: 'Hours Given Back to the Pastor',
          preview: 'FlockOS eliminates the manual admin burden that steals time from real ministry.',
          body: '<p>The reason FlockOS exists is simple: pastoral ministry has been buried under administrative overhead. Studies consistently show that pastors spend 30-50% of their working hours on tasks that could be automated, delegated, or eliminated — communication management, follow-up tracking, content distribution, worship coordination, and member data entry.</p><p>FlockOS was built to give those hours back. Here is a specific accounting of what it replaces:</p><h3>Communication (FlockChat)</h3><ul><li><strong>Eliminates:</strong> Group text threads, email chains, bulletin boards, separate prayer chain emails, the "can you forward this to everyone?" request.</li><li><strong>Saves:</strong> 3-5 hours/week for the average pastor who was managing communication manually.</li></ul><h3>Worship Coordination (FlockStand)</h3><ul><li><strong>Eliminates:</strong> Email chains for set lists, phone calls about song keys, printing lyric sheets, the post-service conversation about what went wrong with the slides.</li><li><strong>Saves:</strong> 2-4 hours/week for the worship leader, and 30-60 minutes/week of pastoral oversight.</li></ul><h3>Discipleship Tracking (GROW)</h3><ul><li><strong>Eliminates:</strong> Spreadsheet maintenance, sticky note follow-ups, the "I thought someone called that family" conversation in staff meetings.</li><li><strong>Saves:</strong> 3-6 hours/week of discipleship admin, depending on church size.</li></ul><h3>Guest Follow-Up (Invite)</h3><ul><li><strong>Eliminates:</strong> Manual guest registration on paper, typed data entry into a separate system, the handwritten follow-up list.</li><li><strong>Saves:</strong> 1-2 hours/week per 10 first-time guests.</li></ul><h3>Content Distribution (FEED)</h3><ul><li><strong>Eliminates:</strong> Designing and sending weekly devotional emails, updating a separate website, managing a church Facebook page for content.</li><li><strong>Saves:</strong> 2-4 hours/week on content logistics.</li></ul><h3>The Total</h3><p>For an active church using all FlockOS modules, the time savings range from <strong>10 to 20 hours per week</strong> of administrative overhead eliminated. Those hours go back to preaching preparation, pastoral visits, prayer, and the work that only the pastor can do. That is why FlockOS exists.</p>'
        }
      ]
    }
  });

  /* ── DOM Helpers ────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);
  const _e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const _initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');

  /* ── Boot ───────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => _boot().catch(err => {
    _setBootStatus('Error: ' + (err?.message || err));
    console.error('[FlockChat]', err);
  }));

  async function _boot() {
    console.log('[FlockChat] Booting', VERSION);
    _setBootStatus('Loading…');
    
    // Wait for Nehemiah (auth must be checked before proceeding)
    await _waitFor(() => typeof window.Nehemiah !== 'undefined');
    
    // Check auth FIRST (like FlockStand does)
    const N = window.Nehemiah;
    if (typeof N.isAuthenticated === 'function' && !N.isAuthenticated()) {
      window.location.replace('app.flockchat/index.html');
      return;
    }
    
    // Get session
    _me = N.getSession ? N.getSession() : null;
    if (!_me) {
      window.location.replace('app.flockchat/index.html');
      return;
    }
    
    // Wait for Firebase + UpperRoom (Firebase Auth wrapper)
    await _waitFor(() => typeof window.firebase !== 'undefined' && typeof window.UpperRoom !== 'undefined');

    _setBootStatus('Connecting…');

    // Authenticate to Firebase via UpperRoom (custom token from GAS).
    // Firestore rules require request.auth != null — without this every
    // read fails with "Missing or insufficient permissions."
    try {
      await window.UpperRoom.init(window.FLOCK_FIREBASE_CONFIG);
      await window.UpperRoom.authenticate();
    } catch (err) {
      _setBootStatus('Sign-in failed. Please refresh.');
      throw err;
    }

    // Init Firestore (after auth so reads succeed)
    try {
      _db = firebase.firestore();
    } catch (err) {
      _setBootStatus('Failed to connect. Please refresh.');
      throw err;
    }

    // Prefer Firebase Auth uid for Firestore writes (matches request.auth.uid)
    try {
      const fbUser = firebase.auth().currentUser;
      if (fbUser && fbUser.uid) _me.uid = fbUser.uid;
    } catch (_) {}

    // Init FCM (push notifications)
    _initFCM().catch(err => console.warn('[FlockChat] FCM init failed:', err));

    // Enrich user doc
    await _enrichUser();

    // Seed default conversations
    await _seedConversations();

    _hideBoot();
    _mountApp();
  }

  function _setBootStatus(msg) {
    const el = $('fc-boot-status');
    if (el) el.textContent = msg;
  }

  function _hideBoot() {
    const b = $('fc-boot');
    if (!b) return;
    b.classList.add('fade-out');
    setTimeout(() => { b.style.display = 'none'; }, 350);
  }

  async function _waitFor(condition, timeout = 10000) {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) throw new Error('Timeout waiting for condition');
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /* ── User Setup ─────────────────────────────────────────────────────── */
  async function _enrichUser() {
    if (!_db || !_me) return;
    const ref = _db.collection('users').doc(_me.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        displayName: _me.displayName || _me.email,
        email: _me.email,
        role: _me.role || 'volunteer',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      const d = snap.data();
      if (d.role && d.role !== _me.role) _me.role = d.role;
      if (d.displayName) _me.displayName = d.displayName;
      ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
    // Grant all-access if role is admin / pastor
    if (/^(admin|pastor|lead_pastor)$/i.test(_me.role || '')) _meIsAllAccess = true;
    // Mark member as FlockChat-active AND capture gender
    _markMemberFlockchatActive().catch(err => console.warn('[FlockChat] flockchatActive flag failed:', err));
    // Resolve Lead Pastor UID + confirm all-access for LP
    await _resolveChurchConfig();
  }

  async function _markMemberFlockchatActive() {
    const myEmail = (_me?.email || '').toLowerCase();
    if (!myEmail || !_db) return;
    // Find by primaryEmail first, then email.
    const tries = [
      _db.collection('members').where('primaryEmail', '==', myEmail).limit(1),
      _db.collection('members').where('email',        '==', myEmail).limit(1)
    ];
    for (const q of tries) {
      try {
        const snap = await q.get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const mData = doc.data() || {};
          // Capture gender for ministry channel filtering
          if (mData.gender) _myGender = mData.gender;
          // Member role may differ from auth role — union grants access
          const mRole = (mData.role || mData.memberType || '').toLowerCase();
          if (/admin|pastor/.test(mRole)) _meIsAllAccess = true;
          await doc.ref.update({
            flockchatActive: true,
            flockchatLastSeen: firebase.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
      } catch (_) { /* try next */ }
    }
  }

  /* ── Church Config (Lead Pastor UID, etc.) ──────────────────────────── */
  async function _resolveChurchConfig() {
    if (!_db || !window.UpperRoom) return;
    try {
      const cfg = await window.UpperRoom.getAppConfig({ key: 'LEAD_PASTOR_MEMBER_ID' });
      const pin = (cfg?.value || '').trim();
      if (!pin) return;

      // Get pastor's member doc → email
      const memberSnap = await _db.collection('members').doc(pin).get();
      if (!memberSnap.exists) return;
      const mData = memberSnap.data() || {};
      const pastorEmail = (mData.primaryEmail || mData.email || '').toLowerCase();
      if (!pastorEmail) return;

      const myEmail = (_me?.email || '').toLowerCase();

      // If I am the Lead Pastor, grant all-access and we're done
      if (myEmail && myEmail === pastorEmail) {
        _meIsAllAccess = true;
        _pastorUid = _me.uid;
        console.log('[FlockChat] Identified as Lead Pastor — all-access granted');
        return;
      }

      // Find pastor's Firebase UID so we can seed a pastoral DM
      const usersSnap = await _db.collection('users')
        .where('email', '==', pastorEmail).limit(1).get();
      if (!usersSnap.empty) {
        _pastorUid = usersSnap.docs[0].id;
        console.log('[FlockChat] Lead Pastor UID resolved:', _pastorUid);
      }
    } catch (err) {
      console.warn('[FlockChat] _resolveChurchConfig failed:', err);
    }
  }

  /* ── FCM Push Notifications ─────────────────────────────────────────── */
  async function _initFCM() {
    if (!firebase.messaging || !firebase.messaging.isSupported || !firebase.messaging.isSupported()) {
      console.log('[FlockChat] FCM not supported');
      return;
    }

    _messaging = firebase.messaging();

    // VAPID key — fetched from Firestore settings/notifications so it is
    // never committed to source control and is per-church configurable.
    // Admins add it via Firebase Console or the FlockOS admin panel:
    //   Firestore → settings → notifications → { vapidKey: "B..." }
    let vapidKey = '';
    try {
      const settingsSnap = await _db.collection('settings').doc('notifications').get();
      vapidKey = (settingsSnap.exists && settingsSnap.data()?.vapidKey) || '';
    } catch (fetchErr) {
      console.warn('[FlockChat] Could not fetch VAPID key from Firestore:', fetchErr);
    }
    if (!vapidKey) {
      console.log('[FlockChat] FCM VAPID key not configured (settings/notifications.vapidKey)');
      return;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FlockChat] Notification permission denied');
      return;
    }

    // Register the FCM service worker explicitly (needed for sub-path PWA)
    let swReg;
    try {
      swReg = await navigator.serviceWorker.register(
        new URL('./firebase-messaging-sw.js', location.href).toString(),
        { scope: new URL('./', location.href).toString() }
      );
    } catch (swErr) {
      console.warn('[FlockChat] FCM SW registration failed:', swErr);
    }

    // Get token
    const tokenOpts = { vapidKey };
    if (swReg) tokenOpts.serviceWorkerRegistration = swReg;
    const token = await _messaging.getToken(tokenOpts);
    console.log('[FlockChat] FCM token:', token);

    // Save token to user doc
    if (_me && token) {
      await _db.collection('users').doc(_me.uid).update({
        fcmToken: token,
        fcmUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(err => console.error('[FlockChat] Failed to save FCM token:', err));
    }

    // Handle foreground messages
    _messaging.onMessage(payload => {
      console.log('[FlockChat] Foreground message:', payload);
      const { notification } = payload;
      if (notification) {
        _toast(notification.title + ': ' + notification.body);
      }
    });
  }

  /* ── Seed Default Conversations ─────────────────────────────────────── */
  async function _seedConversations() {
    // (Church Announcements is NOT seeded — it's a single shared doc at
    //  conversations/announcements, mirrored from the_announcements view.
    //  FlockChat injects it as a static entry in _renderConversations.)

    // Prayer Chain is per-user (a private funnel into the church Prayer
    // Chain). Make sure THIS user has one — independently of whether other
    // users have already seeded their own.
    try {
      const mine = await _db.collection('conversations')
        .where('type', '==', 'prayer')
        .where('participants', 'array-contains', _me.uid)
        .limit(1).get();
      if (mine.empty) {
        console.log('[FlockChat] Seeding Prayer Chain for', _me.uid);
        await _db.collection('conversations').add({
          type: 'prayer',
          name: 'Prayer Chain',
          icon: '🙏',
          participants: [_me.uid],
          lastMessage: {
            text: 'Type a prayer request below — it goes straight to the church Prayer Chain.',
            author: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          unreadCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: _me.uid
        });
      }
    } catch (err) {
      console.warn('[FlockChat] Prayer Chain seed failed:', err);
    }

    // "Message the Pastor" — per-user private pastoral DM.
    // Seeded for every member who isn't the pastor themselves.
    // The Lead Pastor sees inbound DMs in their regular list.
    if (_pastorUid && _pastorUid !== _me.uid) {
      try {
        const pastorMine = await _db.collection('conversations')
          .where('type', '==', 'pastoral')
          .where('participants', 'array-contains', _me.uid)
          .limit(1).get();
        if (pastorMine.empty) {
          console.log('[FlockChat] Seeding Message the Pastor for', _me.uid);
          await _db.collection('conversations').add({
            type: 'pastoral',
            name: 'Message the Pastor',
            icon: '✉️',
            participants: [_me.uid, _pastorUid],
            lastMessage: {
              text: 'Send a private message to the Lead Pastor.',
              author: 'system',
              timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: _me.uid
          });
        }
      } catch (err) {
        console.warn('[FlockChat] Pastoral seed failed:', err);
      }
    }

    // Ensure all group channel docs exist in Firestore (admin-only)
    await _ensureGroupDocs();
  }

  /* ── Ministry Channels (Men's / Women's) ────────────────────────────── */
  function _injectMinistryChannels() {
    // Remove stale injected entries before re-injecting
    _conversations = _conversations.filter(c =>
      c.id !== MENS_MINISTRY_ID && c.id !== WOMENS_MINISTRY_ID
    );

    const showMens   = _meIsAllAccess || _myGender === 'Male';
    const showWomens = _meIsAllAccess || _myGender === 'Female';

    // Insert Women's first so Men's lands on top (unshift reverses order)
    if (showWomens) {
      _conversations.unshift({
        id: WOMENS_MINISTRY_ID,
        type: 'ministry-women',
        name: "Women's Ministry",
        icon: '🌸',
        participants: [],
        lastMessage: { text: _womensLastSnippet || "Welcome to Women\u2019s Ministry.", author: '', timestamp: _womensLastAt },
        lastActivity: _womensLastAt,
        unreadCount: 0,
        _static: true
      });
      _startMinistryListener(WOMENS_MINISTRY_ID, 'womens');
    }

    if (showMens) {
      _conversations.unshift({
        id: MENS_MINISTRY_ID,
        type: 'ministry-men',
        name: "Men\u2019s Ministry",
        icon: '\u2693',
        participants: [],
        lastMessage: { text: _mensLastSnippet || "Welcome to Men\u2019s Ministry.", author: '', timestamp: _mensLastAt },
        lastActivity: _mensLastAt,
        unreadCount: 0,
        _static: true
      });
      _startMinistryListener(MENS_MINISTRY_ID, 'mens');
    }
  }

  function _startMinistryListener(id, which) {
    if (which === 'mens'   && _mensDocUnsub)   return; // already listening
    if (which === 'womens' && _womensDocUnsub) return;
    try {
      const unsub = _db.collection('conversations').doc(id)
        .onSnapshot(doc => {
          const d = doc.exists ? doc.data() : null;
          if (which === 'mens') {
            _mensLastSnippet = d?.lastSnippet || '';
            _mensLastAt      = d?.lastMessageAt || null;
          } else {
            _womensLastSnippet = d?.lastSnippet || '';
            _womensLastAt      = d?.lastMessageAt || null;
          }
          const e = _conversations.find(c => c.id === id);
          if (e) {
            const snippet = (which === 'mens' ? _mensLastSnippet : _womensLastSnippet)
              || `Welcome to ${which === 'mens' ? "Men\u2019s" : "Women\u2019s"} Ministry.`;
            e.lastMessage  = { text: snippet, author: '', timestamp: which === 'mens' ? _mensLastAt : _womensLastAt };
            e.lastActivity = which === 'mens' ? _mensLastAt : _womensLastAt;
            _renderConversations();
          }
        }, err => console.warn(`[FlockChat] ${id} listen failed:`, err));
      if (which === 'mens') _mensDocUnsub = unsub;
      else                  _womensDocUnsub = unsub;
    } catch (err) {
      console.warn(`[FlockChat] ${id} listener setup failed:`, err);
    }
  }

  /* ── All-Member Group Channels (Servant Team, Worship, Missions, etc.) ─ */
  function _injectGroupChannels() {
    // Remove stale entries
    _conversations = _conversations.filter(c => !ALL_MEMBER_GROUPS.some(g => g.id === c.id));

    // Unshift in reverse so the first group in ALL_MEMBER_GROUPS ends up first
    [...ALL_MEMBER_GROUPS].reverse().forEach(g => {
      const st = _grpState[g.id];
      _conversations.unshift({
        id: g.id,
        type: g.type,
        name: g.name,
        participants: [],
        lastMessage: { text: st.snippet || g.welcome, author: '', timestamp: st.lastAt },
        lastActivity: st.lastAt,
        unreadCount: 0,
        _static: true
      });
      _startGroupListener(g.id, g.welcome);
    });
  }

  function _startGroupListener(id, welcomeText) {
    const st = _grpState[id];
    if (st.unsub) return; // already listening
    try {
      st.unsub = _db.collection('conversations').doc(id)
        .onSnapshot(doc => {
          const d = doc.exists ? doc.data() : null;
          st.snippet = d?.lastSnippet || '';
          st.lastAt  = d?.lastMessageAt || null;

          // If this user was banned from the channel, remove it and re-render
          const banned = d?.bannedMembers || [];
          if (!_meIsAllAccess && _me?.uid && banned.includes(_me.uid)) {
            _conversations = _conversations.filter(c => c.id !== id);
            _renderConversations();
            return;
          }
          // If the channel is private and user is not on the members list, hide it
          const accessMode = d?.accessMode || 'open';
          const members = d?.members || [];
          if (!_meIsAllAccess && _me?.uid && accessMode === 'private' && !members.includes(_me.uid)) {
            _conversations = _conversations.filter(c => c.id !== id);
            _renderConversations();
            return;
          }

          const e = _conversations.find(c => c.id === id);
          if (e) {
            e.lastMessage  = { text: st.snippet || welcomeText, author: '', timestamp: st.lastAt };
            e.lastActivity = st.lastAt;
            _renderConversations();
          }
        }, err => console.warn(`[FlockChat] ${id} listener failed:`, err));
    } catch (err) {
      console.warn(`[FlockChat] ${id} listener setup failed:`, err);
    }
  }

  // Creates Firestore conversation docs for all group channels if they don't
  // exist yet. Called once on boot for admin / Lead Pastor users.
  async function _ensureGroupDocs() {
    if (!_db || !_meIsAllAccess) return;
    for (const g of ALL_MEMBER_GROUPS) {
      try {
        const ref  = _db.collection('conversations').doc(g.id);
        const snap = await ref.get();
        if (!snap.exists) {
          await ref.set({
            type: g.type,
            name: g.name,
            participants: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastSnippet: '',
            lastMessageAt: null
          });
          console.log('[FlockChat] Created group channel:', g.id);
        }
      } catch (err) {
        console.warn(`[FlockChat] Could not ensure doc for ${g.id}:`, err);
      }
    }
  }

  /* ── Mount App ──────────────────────────────────────────────────────── */
  function _mountApp() {
    const app = $('fc-app');
    if (app) app.removeAttribute('hidden');

    _bindUI();
    _loadConversations();
  }

  /* ── UI Binding ──────────────────────────────────────────────────────── */
  function _bindUI() {
    // Search
    const search = $('fc-search');
    if (search) {
      search.addEventListener('input', () => _filterConversations(search.value));
    }

    // New conversation button
    const newBtn = $('fc-new-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => _openNewConversationModal());
    }

    // Modal close
    const modalClose = $('fc-modal-close');
    const modalBackdrop = $('fc-new-modal');
    if (modalClose) {
      modalClose.addEventListener('click', () => _closeNewConversationModal());
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) _closeNewConversationModal();
      });
    }

    // User search in modal
    const userSearch = $('fc-user-search');
    if (userSearch) {
      userSearch.addEventListener('input', () => _filterUsers(userSearch.value));
    }

    // Composer input
    const input = $('fc-input');
    const sendBtn = $('fc-send');
    if (input && sendBtn) {
      input.addEventListener('input', () => {
        sendBtn.disabled = !input.value.trim();
        _autoResize(input);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _sendMessage();
        }
      });
      sendBtn.addEventListener('click', () => _sendMessage());
    }

    // Back button (mobile)
    const backBtn = $('fc-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const thread = $('fc-thread');
        if (thread) thread.classList.remove('active');
        _activeConvId = null;
      });
    }
  }

  function _autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  /* ── New Conversation Modal ──────────────────────────────────────────── */
  let _allUsers = [];

  async function _openNewConversationModal() {
    const modal = $('fc-new-modal');
    if (!modal) return;

    // Load users if not already loaded
    if (_allUsers.length === 0) {
      await _loadUsers();
    }

    // Render user list
    _renderUsers(_allUsers);

    // Show modal
    modal.removeAttribute('hidden');
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // Focus search
    const search = $('fc-user-search');
    if (search) {
      search.value = '';
      search.focus();
    }
  }

  function _closeNewConversationModal() {
    const modal = $('fc-new-modal');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
      modal.setAttribute('hidden', '');
    }, 200);
  }

  async function _loadUsers() {
    try {
      // Source of truth = The Fold (members collection), NOT the chat-only
      // `users` collection (which accumulates duplicates from every sign-in).
      const snap = await _db.collection('members').orderBy('lastName').get();
      const myEmail = (_me.email || '').toLowerCase();
      const byEmail = new Map();
      snap.forEach(doc => {
        const m = doc.data() || {};
        m.uid = doc.id;
        // Filter out archived/inactive
        const ms = String(m.membershipStatus || '').toLowerCase();
        const st = String(m.status || '').toLowerCase();
        if (ms === 'archived' || st === 'inactive' || st === 'archived') return;
        // Normalize display fields for the renderer
        const first = m.firstName || '';
        const last  = m.lastName  || '';
        const name  = m.displayName || m.name || (first + ' ' + last).trim() || m.primaryEmail || m.email || 'Unknown';
        const email = (m.primaryEmail || m.email || '').toLowerCase();
        if (!email && !name) return;
        // Exclude self by email (uid won't match — Auth uid vs member doc id)
        if (email && email === myEmail) return;
        // Dedupe by email (fall back to uid when email missing)
        const key = email || m.uid;
        if (byEmail.has(key)) return;
        const phoneRaw = m.primaryPhone || m.mobile || m.phone || m.phoneNumber || '';
        const phone = String(phoneRaw).replace(/[^\d+]/g, '');
        byEmail.set(key, {
          uid: m.uid,
          displayName: name,
          email: email,
          phone: phone,
          flockchatActive: !!m.flockchatActive,
          role: m.role || m.memberType || 'member'
        });
      });
      _allUsers = Array.from(byEmail.values())
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      console.log('[FlockChat] Loaded', _allUsers.length, 'members from The Fold');
      if (_allUsers.length === 0) {
        _toast('No other members found in The Fold yet.', 'info');
      }
    } catch (err) {
      console.error('[FlockChat] Failed to load members:', err);
      _toast('Failed to load members', 'error');
    }
  }

  function _renderUsers(users) {
    const list = $('fc-user-list');
    if (!list) return;

    if (users.length === 0) {
      list.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">👥</div>
          <div class="fc-empty-text">No members found</div>
        </div>
      `;
      return;
    }

    list.innerHTML = users.map(u => {
      const name = u.displayName || u.email || 'Unknown';
      const initials = _initials(name);
      const email = u.email || '';
      const phone = u.phone || '';
      const onFC  = !!u.flockchatActive;
      // Escape quotes for onclick attribute
      const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      // Route: FlockChat user → in-app DM. Otherwise if we have a phone → SMS.
      let onclick, badge, sub;
      if (onFC) {
        onclick = `window._createDirectMessage('${u.uid}', '${safeName}')`;
        badge = '';
        sub = email;
      } else if (phone) {
        onclick = `window._startSmsConversation('${u.uid}', '${safeName}', '${phone}')`;
        badge = '<span class="fc-user-badge sms" title="Not on FlockChat — will text via SMS">SMS</span>';
        sub = phone;
      } else {
        onclick = `window._toast && window._toast('No phone or FlockChat account on file for ' + ${JSON.stringify(name)}, 'info')`;
        badge = '<span class="fc-user-badge muted" title="No phone on file">No contact</span>';
        sub = email || 'No contact info';
      }
      return `
        <div class="fc-user-item ${onFC ? '' : 'sms'}" data-uid="${u.uid}" data-name="${_e(name)}" onclick="${onclick}">
          <div class="fc-user-avatar">${initials}</div>
          <div class="fc-user-info">
            <div class="fc-user-name">${_e(name)} ${badge}</div>
            <div class="fc-user-email">${_e(sub)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _filterUsers(query) {
    const q = query.toLowerCase();
    const filtered = _allUsers.filter(u => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
    _renderUsers(filtered);
  }

  window._createDirectMessage = async function(otherUid, otherName) {
    _closeNewConversationModal();

    console.log('[FlockChat] Creating DM:', { me: _me.uid, other: otherUid, name: otherName });

    // Validate
    if (!otherUid || otherUid === _me.uid) {
      _toast('Cannot create conversation with yourself', 'error');
      return;
    }

    try {
      // Check if DM already exists
      const existingSnap = await _db.collection('conversations')
        .where('type', '==', 'dm')
        .where('participants', 'array-contains', _me.uid)
        .get();

      let existingConv = null;
      existingSnap.forEach(doc => {
        const d = doc.data();
        if (d.participants && d.participants.includes(otherUid)) {
          existingConv = { id: doc.id, ...d };
        }
      });

      if (existingConv) {
        console.log('[FlockChat] Found existing DM:', existingConv.id);
        window._openConversation(existingConv.id);
        return;
      }

      // Create new DM
      console.log('[FlockChat] Creating new DM conversation...');
      const docRef = await _db.collection('conversations').add({
        type: 'dm',
        name: otherName,
        icon: _initials(otherName),
        participants: [_me.uid, otherUid],
        lastMessage: {
          text: '',
          author: '',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: _me.uid
      });

      console.log('[FlockChat] DM created:', docRef.id);
      // Open new conversation
      window._openConversation(docRef.id);
      _toast('Conversation created!', 'success');
    } catch (err) {
      console.error('[FlockChat] Failed to create DM:', err);
      console.error('[FlockChat] Error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      _toast('Failed to create conversation: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  /* ── SMS Fallback (member not on FlockChat) ──────────────────────────── */
  function _smsHref(phone, body) {
    // sms:NUMBER?&body=... works on both iOS and Android.
    const num = String(phone || '').replace(/[^\d+]/g, '');
    const txt = body ? ('?&body=' + encodeURIComponent(body)) : '';
    return 'sms:' + num + txt;
  }

  function _launchSms(phone, body) {
    try { window.location.href = _smsHref(phone, body); } catch (_) {}
  }

  window._startSmsConversation = async function(memberUid, otherName, phone) {
    _closeNewConversationModal();
    if (!phone) { _toast('No phone number on file', 'error'); return; }

    try {
      // Find existing SMS conversation for this phone (so it logs to recents
      // instead of creating a new card every tap).
      const existingSnap = await _db.collection('conversations')
        .where('type', '==', 'sms')
        .where('participants', 'array-contains', _me.uid)
        .get();

      let convId = null;
      existingSnap.forEach(doc => {
        const d = doc.data();
        if (d.smsPhone === phone) convId = doc.id;
      });

      if (!convId) {
        const docRef = await _db.collection('conversations').add({
          type: 'sms',
          name: otherName,
          icon: '💬',
          smsPhone: phone,
          smsMemberUid: memberUid,
          participants: [_me.uid],
          lastMessage: {
            text: 'Texts via SMS — not in FlockChat',
            author: 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          unreadCount: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: _me.uid
        });
        convId = docRef.id;
      } else {
        // Bump lastActivity so it sorts to the top of recents.
        await _db.collection('conversations').doc(convId).update({
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }

      // Open the thread — user types in the FlockChat composer; pressing
      // Send packages the message and hands it off to the native SMS app.
      window._openConversation(convId);
    } catch (err) {
      console.error('[FlockChat] Failed to start SMS conversation:', err);
      _toast('Failed to start SMS: ' + (err.message || 'Unknown'), 'error');
    }
  };

  /* ── Load Conversations ──────────────────────────────────────────────── */
  function _loadConversations() {
    if (_convUnsub) _convUnsub();

    // Render the static pinned threads (Church Announcements) immediately
    // so the list never looks empty — even if the conversations query is
    // still loading or fails outright.
    _conversations = [];
    _injectGroupChannels();
    _injectMinistryChannels();
    _injectAnnouncements();
    _injectInfoChannels();
    _injectSanctuary();
    _injectSermons();
    _injectFlockNews();
    _renderConversations();
    _srmCheckNewBadge();

    _convUnsub = _db.collection('conversations')
      .where('participants', 'array-contains', _me.uid)
      .orderBy('lastActivity', 'desc')
      .onSnapshot(snap => {
        _conversations = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          if (d.id === ANNOUNCEMENTS_ID) return;
          if (ALL_GROUP_IDS.has(d.id)) return;
          if (Array.isArray(d.deletedBy) && d.deletedBy.includes(_me.uid)) return;
          _conversations.push(d);
        });
        _injectGroupChannels();
        _injectMinistryChannels();
        _injectAnnouncements();
        _injectInfoChannels();
        _injectSanctuary();
        _injectSermons();
        _injectFlockNews();
        _renderConversations();
      }, err => {
        console.error('[FlockChat] Failed to load conversations:', err);
        _toast('Failed to load conversations', 'error');
        _conversations = [];
        _injectGroupChannels();
        _injectMinistryChannels();
        _injectAnnouncements();
        _injectInfoChannels();
        _injectSanctuary();
        _injectSermons();
        _injectFlockNews();
        _renderConversations();
      });
  }

  // Listen to the shared announcements doc so the static thread's preview
  // + sort key stay fresh when leadership posts.
  let _annDocUnsub = null;
  let _annLastSnippet = '';
  let _annLastAt = null;

  function _injectAnnouncements() {
    const entry = {
      id: ANNOUNCEMENTS_ID,
      type: 'announcement',
      name: 'Church Announcements',
      icon: '📢',
      participants: [],
      lastMessage: { text: _annLastSnippet || 'Tap to view church-wide announcements.', author: '', timestamp: _annLastAt },
      lastActivity: _annLastAt,
      unreadCount: 0,
      _static: true
    };
    _conversations.unshift(entry);

    if (_annDocUnsub) return; // already listening
    try {
      _annDocUnsub = _db.collection('conversations').doc(ANNOUNCEMENTS_ID)
        .onSnapshot(doc => {
          const d = doc.exists ? doc.data() : null;
          _annLastSnippet = (d && d.lastSnippet) || '';
          _annLastAt = (d && d.lastMessageAt) || null;
          const e = _conversations.find(c => c.id === ANNOUNCEMENTS_ID);
          if (e) {
            e.lastMessage = { text: _annLastSnippet || 'Tap to view church-wide announcements.', author: '', timestamp: _annLastAt };
            e.lastActivity = _annLastAt;
            _renderConversations();
          }
        }, err => console.warn('[FlockChat] announcements doc listen failed:', err));
    } catch (err) {
      console.warn('[FlockChat] announcements doc listen setup failed:', err);
    }
  }

  function _injectInfoChannels() {
    // Remove stale entries first
    _conversations = _conversations.filter(c => !INFO_IDS.has(c.id));
    // FlockOS guide first, FlockChat guide second (unshift reverses)
    _conversations.unshift({
      id: INFO_FLOCKOS_ID,
      type: 'info-flockos',
      name: 'About FlockOS',
      participants: [],
      lastMessage: { text: 'Tap to explore every module and how they work together.', author: '', timestamp: null },
      lastActivity: null,
      unreadCount: 0,
      _static: true
    });
    _conversations.unshift({
      id: INFO_FLOCKCHAT_ID,
      type: 'info-flockchat',
      name: 'About FlockChat',
      participants: [],
      lastMessage: { text: 'Tap to learn every feature and how it connects to your church database.', author: '', timestamp: null },
      lastActivity: null,
      unreadCount: 0,
      _static: true
    });
  }

  function _injectSanctuary() {
    _conversations = _conversations.filter(c => c.id !== SANCTUARY_ID);
    // Unshift last so it lands at the very top of the list
    _conversations.unshift({
      id:           SANCTUARY_ID,
      type:         'my-sanctuary',
      name:         'My Sanctuary',
      participants: [],
      lastMessage:  { text: 'Journal · Prayers · Today\u2019s Word · Reading Plan', author: '', timestamp: null },
      lastActivity: null,
      unreadCount:  0,
      _static:      true
    });
  }

  function _injectSermons() {
    _conversations = _conversations.filter(c => c.id !== SERMONS_ID);
    _conversations.unshift({
      id:           SERMONS_ID,
      type:         'recent-sermons',
      name:         'Recent Sermons',
      participants: [],
      lastMessage:  { text: 'Last 12 preached messages from your church', author: '', timestamp: null },
      lastActivity: null,
      unreadCount:  0,
      _static:      true
    });
  }

  function _injectFlockNews() {
    _conversations = _conversations.filter(c => c.id !== FLOCKNEWS_ID);
    _conversations.unshift({
      id:           FLOCKNEWS_ID,
      type:         'flocknews',
      name:         'FlockNews',
      participants: [],
      lastMessage:  { text: 'Daily spiritual content & bulletin — last 7 days', author: '', timestamp: null },
      lastActivity: null,
      unreadCount:  0,
      _static:      true
    });
  }

  function _filterConversations(query) {
    const list = $('fc-list');
    if (!list) return;
    const q = query.toLowerCase();
    $$('.fc-conv-item').forEach(item => {
      const name = item.dataset.name?.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  }

  /* ── Conversation-row + thread-header SVG icons ────────────────── */
  function _convIcon(c) {
    // DMs show text initials (meaningful identity cue)
    if (c.type === 'dm') return _e(c.icon || '?');
    const S = 'fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    const sz = 'width="24" height="24" viewBox="0 0 24 24"';
    switch (c.type) {
      case 'announcement':
        return `<svg ${sz} ${S}><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      case 'prayer':
        return `<svg ${sz} ${S}><line x1="12" y1="2" x2="12" y2="22"/><line x1="4" y1="8" x2="20" y2="8"/></svg>`;
      case 'sms':
        return `<svg ${sz} ${S}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.18 15.22 19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
      case 'pastoral':
        return `<svg ${sz} ${S}><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
      case 'ministry-men':
        return `<svg ${sz} ${S}><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="22"/><path d="M5 15H2a10 10 0 0 0 20 0h-3"/><line x1="5" y1="8" x2="19" y2="8"/></svg>`;
      case 'ministry-women':
        return `<svg ${sz} ${S}><path d="M12 22V12"/><path d="M12 12c0 0-4-3-4-6a4 4 0 0 1 8 0c0 3-4 6-4 6z"/><path d="M12 12c0 0-4 1-6 4a4 4 0 0 0 6 0"/><path d="M12 12c0 0 4 1 6 4a4 4 0 0 1-6 0"/></svg>`;
      case 'servant-team':
        return `<svg ${sz} ${S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
      case 'worship-team':
        return `<svg ${sz} ${S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
      case 'missions-team':
        return `<svg ${sz} ${S}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
      case 'church-life':
        return `<svg ${sz} ${S}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      case 'stewardship':
        return `<svg ${sz} ${S}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
      case 'outreach':
        return `<svg ${sz} ${S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      case 'info-flockchat':
        return `<svg ${sz} ${S}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="9" x2="12" y2="9"/><line x1="12" y1="13" x2="12" y2="17"/></svg>`;
      case 'info-flockos':
        return `<svg ${sz} ${S}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>`;
      case 'my-sanctuary':
        return `<svg ${sz} ${S}><line x1="12" y1="2" x2="12" y2="8"/><path d="M9 8c0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-3-5-3-5S9 6 9 8z"/><rect x="10" y="11" width="4" height="11" rx="1"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`;
      case 'recent-sermons':
        return `<svg ${sz} ${S}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
      default:
        return `<svg ${sz} ${S}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    }
  }

  /* ── Pinned-bubble SVG icons (consistent FlockChat colour palette) ──── */
  function _pinnedIcon(type) {
    const S = 'fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    switch (type) {
      case 'announcement':
        // Megaphone with sound waves
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>`;
      case 'prayer':
        // Latin cross
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <line x1="12" y1="2" x2="12" y2="22"/>
          <line x1="4" y1="8" x2="20" y2="8"/>
        </svg>`;
      case 'pastoral':
        // Envelope with a heart – private pastoral message
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
          <path d="M12 13l-8-6h16l-8 6z"/>
        </svg>`;
      case 'ministry-men':
        // Anchor
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <circle cx="12" cy="5" r="3"/>
          <line x1="12" y1="8" x2="12" y2="22"/>
          <path d="M5 15H2a10 10 0 0 0 20 0h-3"/>
          <line x1="5" y1="8" x2="19" y2="8"/>
        </svg>`;
      case 'ministry-women':
        // Lily / bloom
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M12 22V12"/>
          <path d="M12 12C12 12 8 9 8 6a4 4 0 0 1 8 0c0 3-4 6-4 6z"/>
          <path d="M12 12c0 0-4 1-6 4a4 4 0 0 0 6 0"/>
          <path d="M12 12c0 0 4 1 6 4a4 4 0 0 1-6 0"/>
        </svg>`;
      case 'servant-team':
        // Shield — protection & service
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>`;
      case 'worship-team':
        // Music note
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>`;
      case 'missions-team':
        // Globe
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>`;
      case 'church-life':
        // Heart
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>`;
      case 'stewardship':
        // Key
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>`;
      case 'outreach':
        // Group with outward arrow
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>`;
      case 'info-flockchat':
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="9" x2="12" y2="9"/>
          <line x1="12" y1="13" x2="12" y2="17"/>
        </svg>`;
      case 'info-flockos':
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="8"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
        </svg>`;
      case 'my-sanctuary':
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <line x1="12" y1="2" x2="12" y2="8"/>
          <path d="M9 8c0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-3-5-3-5S9 6 9 8z"/>
          <rect x="10" y="11" width="4" height="11" rx="1"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>`;
      case 'recent-sermons':
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>`;
      case 'flocknews':
        // Stacked layers icon matching the launcher
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>`;
      default:
        // Generic chat bubble
        return `<svg width="28" height="28" viewBox="0 0 24 24" ${S}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>`;
    }
  }

  function _isStaticConv(c) {
    return c && (c._static === true || ALL_GROUP_IDS.has(c.id)
      || c.type === 'announcement'
      || c.type === 'prayer'
      || c.type === 'ministry-men'
      || c.type === 'ministry-women'
      || c.type === 'info-flockchat'
      || c.type === 'info-flockos'
      || c.type === 'my-sanctuary'
      || c.type === 'recent-sermons'
      || c.type === 'flocknews'
      || ALL_MEMBER_GROUPS.some(g => g.type === c.type));
  }
  function _isArchivedForMe(c) {
    return c && Array.isArray(c.archivedBy) && c.archivedBy.includes(_me?.uid);
  }

  function _renderConversations() {
    const list = $('fc-list');
    if (!list) return;

    // Split into visible vs archived (static threads always visible).
    const archivedCount = _conversations.filter(c => !_isStaticConv(c) && _isArchivedForMe(c)).length;
    const visible = _conversations.filter(c => {
      if (_isStaticConv(c)) return true;
      const archived = _isArchivedForMe(c);
      return _showArchived ? archived : !archived;
    });

    if (visible.length === 0 && archivedCount === 0) {
      list.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">💬</div>
          <div class="fc-empty-title">No conversations yet</div>
          <div class="fc-empty-text">Start a conversation to get started!</div>
        </div>
      `;
      return;
    }

    // ── Pinned section (all channel types) ───────────────────────────────
    const PINNED_TYPES = [
      'my-sanctuary', 'recent-sermons', 'flocknews',
      'announcement', 'prayer', 'pastoral',
      'ministry-men', 'ministry-women',
      'servant-team', 'worship-team', 'missions-team',
      'church-life', 'stewardship', 'outreach',
      'info-flockchat', 'info-flockos'
    ];
    const pinned  = visible.filter(c => PINNED_TYPES.includes(c.type));
    const regular = visible.filter(c => !PINNED_TYPES.includes(c.type));

    let pinnedHtml = '';
    if (pinned.length > 0) {
      const bubbles = pinned.map(c => {
        const isActive  = c.id === _activeConvId;
        const unread    = c.unreadCount || 0;
        const typeClass = c.type; // maps directly to CSS class
        const badge     = unread > 0
          ? `<div class="fc-pinned-badge">${unread > 9 ? '9+' : unread}</div>` : '';
        return `
          <div class="fc-pinned-item ${isActive ? 'active' : ''}"
               data-id="${c.id}"
               onclick="window._openConversation('${c.id}')">
            <div class="fc-pinned-bubble ${typeClass}">
              ${_pinnedIcon(c.type)}
              ${badge}
            </div>
            <div class="fc-pinned-name">${_e(c.name)}</div>
          </div>`;
      }).join('');
      pinnedHtml = `
        <div class="fc-pinned-section">
          <div class="fc-pinned-header">
            <span class="fc-pinned-header-icon">📌</span>
            <span class="fc-pinned-header-label">Pinned</span>
          </div>
          <div class="fc-pinned-grid">${bubbles}</div>
        </div>`;
    }

    // ── Regular conversation rows ─────────────────────────────────────────
    const rows = regular.map(c => {
      const isActive = c.id === _activeConvId;
      const unread = c.unreadCount || 0;
      const time = _formatTime(c.lastActivity);
      const preview = c.lastMessage?.text || 'No messages yet';
      const isStatic = _isStaticConv(c);
      const menuOpen = _openMenuConvId === c.id;

      let iconClass = 'fc-conv-icon';
      if (c.type === 'prayer')       iconClass += ' prayer';
      if (c.type === 'announcement') iconClass += ' announcement';
      if (c.type === 'dm')           iconClass += ' dm';
      if (c.type === 'sms')          iconClass += ' sms';
      if (c.type === 'pastoral')     iconClass += ' pastoral';
      if (c.type === 'ministry-men') iconClass += ' ministry-men';
      if (c.type === 'ministry-women') iconClass += ' ministry-women';

      const actionsBtn = isStatic ? '' : `
          <button class="fc-conv-actions-btn ${menuOpen ? 'open' : ''}"
                  title="More"
                  onclick="event.stopPropagation(); window._toggleConvMenu('${c.id}')">⋯</button>
          ${menuOpen ? `
            <div class="fc-conv-menu" onclick="event.stopPropagation()">
              <button onclick="window._archiveConv('${c.id}')">${_isArchivedForMe(c) ? 'Unarchive' : 'Archive'}</button>
              <button class="danger" onclick="window._deleteConv('${c.id}')">Delete</button>
            </div>
          ` : ''}
      `;

      return `
        <div class="fc-conv-item ${isActive ? 'active' : ''} ${unread > 0 ? 'unread' : ''}"
             data-id="${c.id}"
             data-name="${_e(c.name)}"
             onclick="window._openConversation('${c.id}')">
          <div class="${iconClass}">${_convIcon(c)}</div>
          <div class="fc-conv-content">
            <div class="fc-conv-header">
              <div class="fc-conv-name">${_e(c.name)}</div>
              <div class="fc-conv-time">${time}</div>
            </div>
            <div class="fc-conv-preview">${_e(preview)}</div>
          </div>
          ${unread > 0 ? `<div class="fc-conv-badge">${unread}</div>` : ''}
          ${actionsBtn}
        </div>
      `;
    }).join('');

    let footer = '';
    if (_showArchived) {
      footer = `<button class="fc-archive-toggle" onclick="window._toggleArchivedView()">← Back to active</button>`;
    } else if (archivedCount > 0) {
      footer = `<button class="fc-archive-toggle" onclick="window._toggleArchivedView()">Show archived (${archivedCount})</button>`;
    }

    list.innerHTML = pinnedHtml + rows + footer;
  }

  // Close menu when clicking elsewhere
  document.addEventListener('click', () => {
    if (_openMenuConvId) {
      _openMenuConvId = null;
      _renderConversations();
    }
  });

  window._toggleConvMenu = function(convId) {
    _openMenuConvId = (_openMenuConvId === convId) ? null : convId;
    _renderConversations();
  };

  window._toggleArchivedView = function() {
    _showArchived = !_showArchived;
    _openMenuConvId = null;
    _renderConversations();
  };

  window._archiveConv = async function(convId) {
    _openMenuConvId = null;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv || _isStaticConv(conv)) return;
    const archived = _isArchivedForMe(conv);
    try {
      const op = archived
        ? firebase.firestore.FieldValue.arrayRemove(_me.uid)
        : firebase.firestore.FieldValue.arrayUnion(_me.uid);
      await _db.collection('conversations').doc(convId).update({ archivedBy: op });
      _toast(archived ? 'Conversation unarchived' : 'Conversation archived', 'success');
    } catch (err) {
      console.error('[FlockChat] archive failed:', err);
      _toast('Failed to update conversation', 'error');
    }
  };

  window._deleteConv = async function(convId) {
    _openMenuConvId = null;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv || _isStaticConv(conv)) return;
    if (!confirm(`Delete "${conv.name}" from your messages?\n\nThe conversation will be removed from your view. Other participants keep their copy.`)) return;

    try {
      // Soft-delete for me: drop from participants + record in deletedBy.
      await _db.collection('conversations').doc(convId).update({
        participants: firebase.firestore.FieldValue.arrayRemove(_me.uid),
        deletedBy:    firebase.firestore.FieldValue.arrayUnion(_me.uid)
      });

      // If everyone has deleted it, hard-delete the doc + its messages.
      const fresh = await _db.collection('conversations').doc(convId).get();
      const data = fresh.exists ? fresh.data() : null;
      if (data && Array.isArray(data.participants) && data.participants.length === 0) {
        try {
          const msgs = await _db.collection('conversations').doc(convId).collection('messages').get();
          const batch = _db.batch();
          msgs.forEach(m => batch.delete(m.ref));
          batch.delete(_db.collection('conversations').doc(convId));
          await batch.commit();
        } catch (e) {
          // Best-effort hard delete; soft delete already succeeded.
          console.warn('[FlockChat] hard-delete cleanup failed:', e);
        }
      }

      // If we were viewing it, clear the thread.
      if (_activeConvId === convId) {
        _activeConvId = null;
        if (_msgUnsub) { _msgUnsub(); _msgUnsub = null; }
        const thread = $('fc-thread');
        if (thread) thread.classList.remove('active');
        const name = $('fc-thread-name'); if (name) name.textContent = 'Select a conversation';
        const meta = $('fc-thread-meta'); if (meta) meta.textContent = '';
        const msgContainer = $('fc-messages');
        if (msgContainer) msgContainer.innerHTML = '';
      }
      _toast('Conversation deleted', 'success');
    } catch (err) {
      console.error('[FlockChat] delete failed:', err);
      _toast('Failed to delete conversation', 'error');
    }
  };

  /* ── Open Conversation ───────────────────────────────────────────────── */
  window._openConversation = function(convId) {
    _activeConvId = convId;
    const conv = _conversations.find(c => c.id === convId);
    if (!conv) return;

    // Mark as read
    _markAsRead(convId);

    // Update UI
    _renderConversations();
    
    // Update thread header
    const icon = $('fc-thread-icon');
    const name = $('fc-thread-name');
    const meta = $('fc-thread-meta');
    if (icon) icon.innerHTML = _convIcon(conv);
    if (name) name.textContent = conv.name;
    if (meta) {
      const count = conv.participants?.length || 0;
      if (conv.type === 'sms')           meta.textContent = 'SMS • ' + (conv.smsPhone || 'no number');
      else if (conv.type === 'prayer')        meta.textContent = 'Prayer Chain • posts here become church prayer requests';
      else if (conv.type === 'announcement')  meta.textContent = 'Church-wide announcements';
      else if (conv.type === 'pastoral')      meta.textContent = 'Private message to the Lead Pastor';
      else if (conv.type === 'ministry-men')  meta.textContent = "Men\u2019s Ministry \u2022 visible to men + pastoral staff";
      else if (conv.type === 'ministry-women') meta.textContent = "Women\u2019s Ministry \u2022 visible to women + pastoral staff";
      else if (conv.type === 'servant-team')  meta.textContent = 'Servant Team (Deacons) \u2022 group channel';
      else if (conv.type === 'worship-team')  meta.textContent = 'Worship Team \u2022 group channel';
      else if (conv.type === 'missions-team') meta.textContent = 'Missions Team \u2022 group channel';
      else if (conv.type === 'church-life')   meta.textContent = 'Church Life \u2022 fellowship & community';
      else if (conv.type === 'stewardship')   meta.textContent = 'Stewardship \u2022 giving & resources';
      else if (conv.type === 'outreach')      meta.textContent = 'Outreach \u2022 evangelism & outreach contacts';
      else if (conv.type === 'info-flockchat') meta.textContent = 'FlockChat guide \u2022 tap any card to read more';
      else if (conv.type === 'info-flockos')   meta.textContent = 'FlockOS guide \u2022 tap any card to read more';
      else if (conv.type === 'my-sanctuary')   meta.textContent = 'Your personal devotional & prayer hub';
      else if (conv.type === 'recent-sermons') meta.textContent = 'Last 12 preached sermons from your church';
      else meta.textContent = conv.type === 'dm' ? 'Direct Message' : `${count} ${count === 1 ? 'member' : 'members'}`;
    }

    // Show manage button for admin on group/ministry channels
    const manageBtn = $('fc-manage-btn');
    if (manageBtn) {
      const MANAGEABLE = [
        'announcement', 'prayer', 'ministry-men', 'ministry-women',
        ...ALL_MEMBER_GROUPS.map(g => g.type)
      ];
      if (_meIsAllAccess && MANAGEABLE.includes(conv.type)) {
        manageBtn.removeAttribute('hidden');
      } else {
        manageBtn.setAttribute('hidden', '');
      }
    }

    // Composer hint for SMS threads
    const inputEl = $('fc-input');
    if (inputEl) {
      inputEl.placeholder = (conv.type === 'sms')
        ? 'Type a message — will open your SMS app…'
        : (conv.type === 'prayer')
          ? 'Share a prayer request…'
          : (conv.type === 'announcement')
            ? 'Post an announcement to the whole church…'
            : (conv.type === 'pastoral')
              ? 'Message the Pastor privately…'
              : (conv.type === 'ministry-men')
                ? "Post to Men\u2019s Ministry\u2026"
                : (conv.type === 'ministry-women')
                  ? "Post to Women\u2019s Ministry\u2026"
                  : (conv.type === 'servant-team') ? 'Post to Servant Team\u2026'
                  : (conv.type === 'worship-team') ? 'Post to Worship Team\u2026'
                  : (conv.type === 'missions-team') ? 'Post to Missions Team\u2026'
                  : (conv.type === 'church-life') ? 'Post to Church Life\u2026'
                  : (conv.type === 'stewardship') ? 'Post to Stewardship\u2026'
                  : (conv.type === 'outreach') ? 'Post to Outreach\u2026'
                  : 'FlockChat';
    }

    // Show thread pane (mobile)
    const thread = $('fc-thread');
    if (thread) thread.classList.add('active');

    // Hide composer for read-only info channels and sanctuary (has its own input)
    const composer = document.querySelector('.fc-composer');
    if (composer) {
      const hideComposer = INFO_IDS.has(convId) || convId === SANCTUARY_ID || convId === SERMONS_ID || convId === FLOCKNEWS_ID;
      composer.style.display = hideComposer ? 'none' : '';
    }

    // Load messages
    _loadMessages(convId);
  };

  function _markAsRead(convId) {
    // Static shared channels have no per-user unreadCount — skip.
    if (ALL_GROUP_IDS.has(convId)) return;
    _db.collection('conversations').doc(convId).update({
      unreadCount: 0
    }).catch(() => {});
  }

  /* ── Load Messages ───────────────────────────────────────────────────── */
  function _loadMessages(convId) {
    if (_msgUnsub) _msgUnsub();

    const msgContainer = $('fc-messages');
    if (!msgContainer) return;

    // Info channels are fully static — render cards immediately, no Firestore
    if (INFO_IDS.has(convId)) {
      _renderInfoMessages(convId, msgContainer);
      return;
    }

    // Personal sanctuary hub — journal, prayers, devotional, reading
    if (convId === SANCTUARY_ID) {
      _renderSanctuary(msgContainer);
      return;
    }

    // Recent Sermons feed
    if (convId === SERMONS_ID) {
      _renderSermons(msgContainer);
      return;
    }

    // FlockNews feed — last 7 days
    if (convId === FLOCKNEWS_ID) {
      _renderFlockNews(msgContainer);
      return;
    }

    msgContainer.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';

    // Special path: shared church announcements channel
    if (convId === ANNOUNCEMENTS_ID) {
      _msgUnsub = _db.collection('conversations').doc(convId).collection('messages')
        .orderBy('sentAt', 'asc')
        .limit(MSG_LIMIT)
        .onSnapshot(snap => {
          _messages = [];
          snap.forEach(doc => {
            const d = doc.data() || {};
            _messages.push({
              id:         doc.id,
              text:       d.body || d.text || '',
              author:     d.senderEmail || d.author || '',
              authorName: d.senderName  || d.authorName || 'Leadership',
              type:       'announcement',
              timestamp:  d.sentAt || d.timestamp || null
            });
          });
          if (_messages.length === 0) {
            const c = $('fc-messages');
            if (c) c.innerHTML = `
              <div class="fc-empty">
                <div class="fc-empty-icon">📢</div>
                <div class="fc-empty-title">No announcements yet</div>
                <div class="fc-empty-text">When leadership posts, it'll show up here.</div>
              </div>`;
            return;
          }
          _renderMessages();
          _scrollToBottom();
        }, err => {
          console.error('[FlockChat] Failed to load announcements:', err);
          msgContainer.innerHTML = `
            <div class="fc-empty">
              <div class="fc-empty-icon">⚠️</div>
              <div class="fc-empty-title">Couldn't load announcements</div>
              <div class="fc-empty-text">Please try again.</div>
            </div>`;
        });
      return;
    }

    _msgUnsub = _db.collection('conversations').doc(convId).collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(MSG_LIMIT)
      .onSnapshot(snap => {
        _messages = [];
        snap.forEach(doc => {
          const d = doc.data();
          d.id = doc.id;
          _messages.push(d);
        });
        _renderMessages();
        _scrollToBottom();
      }, err => {
        console.error('[FlockChat] Failed to load messages:', err);
        msgContainer.innerHTML = `
          <div class="fc-empty">
            <div class="fc-empty-icon">⚠️</div>
            <div class="fc-empty-title">Failed to load messages</div>
            <div class="fc-empty-text">Please try again.</div>
          </div>
        `;
      });
  }

  /* ── Info Channel Renderer ───────────────────────────────────────────── */
  function _renderInfoMessages(convId, container) {
    const data = _INFO_DATA[convId];
    if (!data) { container.innerHTML = ''; return; }
    let html = '<div class="fc-info-list">';
    data.msgs.forEach((msg, i) => {
      html += `
        <div class="fc-info-card" role="button" tabindex="0"
             onclick="window._openInfoModal('${_e(convId)}',${i})"
             onkeydown="if(event.key==='Enter'||event.key===' ')window._openInfoModal('${_e(convId)}',${i})">
          <div class="fc-info-card-icon">${msg.icon}</div>
          <div class="fc-info-card-body">
            <div class="fc-info-card-title">${_e(msg.title)}</div>
            <div class="fc-info-card-preview">${_e(msg.preview)}</div>
          </div>
          <div class="fc-info-card-arrow">›</div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  window._openInfoModal = function(convId, idx) {
    const data = _INFO_DATA[convId];
    if (!data) return;
    const msg = data.msgs[idx];
    if (!msg) return;
    const modal      = $('fc-info-modal');
    const titleEl    = $('fc-info-modal-title');
    const subtitleEl = $('fc-info-modal-subtitle');
    const bodyEl     = $('fc-info-modal-body');
    if (!modal || !bodyEl) return;
    if (titleEl)    titleEl.innerHTML    = msg.icon + '&nbsp;&nbsp;' + _e(msg.title);
    if (subtitleEl) subtitleEl.textContent = msg.preview;
    bodyEl.innerHTML = msg.body;
    modal.removeAttribute('hidden');
    bodyEl.scrollTop = 0;
  };

  window._closeInfoModal = function() {
    $('fc-info-modal')?.setAttribute('hidden', '');
  };

  /* ── My Sanctuary — Personal Hub ─────────────────────────────────────── */

  function _renderSanctuary(container) {
    const tabs = [
      { id: 'journal', label: 'Journal'       },
      { id: 'prayers', label: 'Prayers'        },
      { id: 'word',    label: 'Today\u2019s Word' },
      { id: 'reading', label: 'Reading'        },
    ];
    container.innerHTML = `
      <div class="fc-sanctuary">
        <div class="fc-sct-tabs" role="tablist">
          ${tabs.map(t => `<button class="fc-sct-tab${_sanctuaryTab === t.id ? ' active' : ''}" data-tab="${_e(t.id)}" role="tab" onclick="window._switchSanctuaryTab('${_e(t.id)}')">${_e(t.label)}</button>`).join('')}
        </div>
        <div class="fc-sct-pane" id="fc-sct-pane"></div>
      </div>`;
    _loadSanctuaryPane(_sanctuaryTab);
  }

  window._switchSanctuaryTab = function(tabId) {
    _sanctuaryTab = tabId;
    document.querySelectorAll('.fc-sct-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tabId));
    if (tabId === 'word' || tabId === 'reading') _sctMarkSeen(tabId);
    _loadSanctuaryPane(tabId);
  };

  async function _loadSanctuaryPane(tabId) {
    const pane = document.getElementById('fc-sct-pane');
    if (!pane) return;
    pane.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';
    if      (tabId === 'journal') await _sctJournal(pane);
    else if (tabId === 'prayers') await _sctPrayers(pane);
    else if (tabId === 'word')    { _sctMarkSeen('word');    await _sctWord(pane); }
    else if (tabId === 'reading') { _sctMarkSeen('reading'); await _sctReading(pane); }
  }

  /* Journal tab */
  let _jAllEntries = [];
  let _jPage      = 0;
  let _jPageSize  = 25;

  async function _sctJournal(pane, opts = {}) {
    // Allow callers to change page / page size without re-fetching
    if (opts.page     !== undefined) _jPage     = opts.page;
    if (opts.pageSize !== undefined) { _jPageSize = opts.pageSize; _jPage = 0; }

    // Fetch only when called fresh (no forceRefetch = false flag)
    if (opts.forceRefetch !== false) {
      const UR = window.UpperRoom;
      _jAllEntries = [];
      if (UR && typeof UR.listJournal === 'function') {
        try { _jAllEntries = await UR.listJournal({ limit: 500 }) || []; }
        catch (err) { console.warn('[Sanctuary] journal fetch', err); }
      }
    }

    const total   = _jAllEntries.length;
    const pages   = Math.max(1, Math.ceil(total / _jPageSize));
    _jPage        = Math.min(_jPage, pages - 1);
    const start   = _jPage * _jPageSize;
    const slice   = _jAllEntries.slice(start, start + _jPageSize);
    const end     = Math.min(start + _jPageSize, total);

    const pageSizeOpts = [25, 50, 75, 100].map(n =>
      `<option value="${n}"${n === _jPageSize ? ' selected' : ''}>${n}</option>`).join('');

    const paginationBar = total > _jPageSize ? `
      <div class="fc-sct-pagination">
        <button class="fc-sct-pg-btn" onclick="window._jChangePage(${_jPage - 1})" ${_jPage === 0 ? 'disabled' : ''}>&lsaquo; Prev</button>
        <span class="fc-sct-pg-info">${start + 1}&ndash;${end} of ${total}</span>
        <button class="fc-sct-pg-btn" onclick="window._jChangePage(${_jPage + 1})" ${_jPage >= pages - 1 ? 'disabled' : ''}>Next &rsaquo;</button>
      </div>` : '';

    pane.innerHTML = `
      <div class="fc-sct-section">
        <div class="fc-sct-compose">
          <textarea class="fc-sct-compose-text" id="fc-sct-jtext" placeholder="Write your thoughts, reflections, or anything on your heart\u2026"></textarea>
          <div class="fc-sct-compose-footer">
            <label class="fc-sct-priv-label"><input type="checkbox" id="fc-sct-jpriv" checked><span>Private</span></label>
            <button class="fc-sct-save-btn" onclick="window._saveJournalEntry()">Save Entry</button>
          </div>
        </div>
        ${total > 0 ? `
        <div class="fc-sct-list-header">
          <span class="fc-sct-list-count">${total} entr${total === 1 ? 'y' : 'ies'}</span>
          <label class="fc-sct-per-page">
            Per page:
            <select class="fc-sct-per-page-sel" onchange="window._jChangePageSize(+this.value)">${pageSizeOpts}</select>
          </label>
        </div>` : ''}
        <div class="fc-sct-list" id="fc-sct-jlist">
          ${slice.length ? slice.map(e => _sctJournalEntryHTML(e)).join('') : '<div class="fc-sct-empty">No journal entries yet. Write your first one above.</div>'}
        </div>
        ${paginationBar}
      </div>`;
  }

  window._jChangePage = function(page) {
    const pane = document.getElementById('fc-sct-pane');
    if (pane) _sctJournal(pane, { page, forceRefetch: false });
  };

  window._jChangePageSize = function(size) {
    const pane = document.getElementById('fc-sct-pane');
    if (pane) _sctJournal(pane, { pageSize: size, forceRefetch: false });
  };

  function _sctJournalEntryHTML(e) {
    const date = _sctDate(e.createdAt);
    const isPrivate = e.private !== false;
    const bodyText = e.entry || e.body || e.text || '';
    const titleText = e.title || '';
    const isShared = !!e.sharedWithPastor;
    const shareBtn = isShared
      ? `<span class="fc-sct-badge published">Shared with Pastor \u2713</span>`
      : `<button class="fc-sct-publish-btn" onclick="window._shareJournalWithPastor('${_e(e.id)}')">Share with the Pastor</button>`;
    return `
      <div class="fc-sct-entry" data-entry-id="${_e(e.id)}" data-entry-body="${_e(bodyText)}">
        <div class="fc-sct-entry-meta">
          <span class="fc-sct-entry-date">${date}</span>
          <span class="fc-sct-badge ${isPrivate ? 'private' : 'shared'}">${isPrivate ? 'Private' : 'Shared'}</span>
          <button class="fc-sct-entry-edit" title="Edit" onclick="window._editJournalEntry('${_e(e.id)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="fc-sct-entry-del" title="Delete" onclick="window._confirmJournalDelete('${_e(e.id)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div class="fc-sct-entry-share-row">${shareBtn}</div>
        ${titleText ? `<div class="fc-sct-entry-title">${_e(titleText)}</div>` : ''}
        <div class="fc-sct-entry-text">${_e(bodyText)}</div>
      </div>`;
  }

  window._confirmJournalDelete = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card || card.querySelector('.fc-sct-del-confirm')) return;
    const delBtn = card.querySelector('.fc-sct-entry-del');
    if (delBtn) delBtn.style.visibility = 'hidden';
    const row = document.createElement('span');
    row.className = 'fc-sct-del-confirm';
    row.innerHTML = `<span class="fc-sct-del-label">Delete?</span>
      <button class="fc-sct-del-yes" onclick="window._executeJournalDelete('${_e(id)}')">Yes</button>
      <button class="fc-sct-del-no" onclick="window._cancelDeleteConfirm('${_e(id)}')">No</button>`;
    const meta = card.querySelector('.fc-sct-entry-meta');
    if (meta) meta.appendChild(row);
  };

  window._cancelDeleteConfirm = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    const row = card.querySelector('.fc-sct-del-confirm');
    if (row) row.remove();
    const delBtn = card.querySelector('.fc-sct-entry-del');
    if (delBtn) delBtn.style.visibility = '';
  };

  window._executeJournalDelete = async function(id) {
    if (!id) return;
    const UR = window.UpperRoom;
    if (!UR || typeof UR.deleteJournal !== 'function') return;
    try { await UR.deleteJournal({ id }); }
    catch (err) { console.error('[Sanctuary] delete journal', err); return; }
    const pane = document.getElementById('fc-sct-pane');
    if (pane && _sanctuaryTab === 'journal') await _sctJournal(pane);
  };

  window._shareJournalWithPastor = async function(id) {
    if (!id || !_db || !_me || !_pastorUid) return;
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    const bodyText = card ? (card.dataset.entryBody || '') : '';
    const btn = card ? card.querySelector('.fc-sct-publish-btn') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Sharing\u2026'; }
    try {
      // Find (or create) this member's pastoral conversation
      let pastorConvId = null;
      const snap = await _db.collection('conversations')
        .where('type', '==', 'pastoral')
        .where('participants', 'array-contains', _me.uid)
        .limit(1).get();
      if (!snap.empty) {
        pastorConvId = snap.docs[0].id;
      } else if (_pastorUid !== _me.uid) {
        const ref = await _db.collection('conversations').add({
          type: 'pastoral', name: 'Message the Pastor', icon: '\u2709\ufe0f',
          participants: [_me.uid, _pastorUid],
          lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: _me.uid,
        });
        pastorConvId = ref.id;
      }
      if (pastorConvId) {
        await _db.collection('conversations').doc(pastorConvId)
          .collection('messages').add({
            text: bodyText,
            authorName:  _me.name || _me.email,
            author:      _me.uid,
            authorEmail: _me.email,
            timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
            sharedFromJournal: true,
          });
      }
      await _db.collection('journal').doc(id).update({
        sharedWithPastor:   true,
        sharedWithPastorAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error('[Sanctuary] share journal with pastor', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Share with the Pastor'; }
      return;
    }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) await _sctJournal(pane);
  };

  window._editJournalEntry = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    // Already in edit mode?
    if (card.querySelector('.fc-sct-edit-area')) return;
    const bodyText = card.dataset.entryBody || '';
    const textEl = card.querySelector('.fc-sct-entry-text');
    if (textEl) textEl.style.display = 'none';
    const editEl = document.createElement('div');
    editEl.className = 'fc-sct-edit-block';
    editEl.innerHTML = `
      <textarea class="fc-sct-edit-area" rows="5">${_e(bodyText)}</textarea>
      <div class="fc-sct-edit-actions">
        <button class="fc-sct-edit-cancel" onclick="window._cancelJournalEdit('${_e(id)}')">Cancel</button>
        <button class="fc-sct-edit-save" onclick="window._saveJournalEdit('${_e(id)}')">Save</button>
      </div>`;
    card.appendChild(editEl);
    editEl.querySelector('textarea').focus();
  };

  window._cancelJournalEdit = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    const textEl = card.querySelector('.fc-sct-entry-text');
    if (textEl) textEl.style.display = '';
    const editEl = card.querySelector('.fc-sct-edit-block');
    if (editEl) editEl.remove();
  };

  window._saveJournalEdit = async function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    const ta = card.querySelector('.fc-sct-edit-area');
    if (!ta) return;
    const newText = ta.value.trim();
    if (!newText) return;
    const saveBtn = card.querySelector('.fc-sct-edit-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    const UR = window.UpperRoom;
    try {
      if (!UR || typeof UR.updateJournal !== 'function') throw new Error('UpperRoom unavailable');
      await UR.updateJournal({ id, entry: newText });
    } catch (err) {
      console.error('[Sanctuary] edit journal', err);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      return;
    }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) await _sctJournal(pane);
  };

  window._saveJournalEntry = async function() {
    const ta = document.getElementById('fc-sct-jtext');
    const privCb = document.getElementById('fc-sct-jpriv');
    if (!ta) return;
    const text = (ta.value || '').trim();
    if (!text) return;
    const btn = document.querySelector('#fc-sct-pane .fc-sct-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    const UR = window.UpperRoom;
    try {
      if (!UR || typeof UR.createJournal !== 'function') throw new Error('UpperRoom unavailable');
      await UR.createJournal({ entry: text, private: !!(privCb && privCb.checked) });
      ta.value = '';
    } catch (err) {
      console.error('[Sanctuary] save journal', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Save Entry'; }
      return;
    }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) { _jPage = 0; await _sctJournal(pane); }
  };

  // _deleteJournalEntry kept for legacy callers; UI now goes through _confirmJournalDelete
  window._deleteJournalEntry = window._executeJournalDelete;

  /* Prayers tab */
  let _pAllEntries = [];
  let _pPage      = 0;
  let _pPageSize  = 25;

  async function _sctPrayers(pane, opts = {}) {
    if (opts.page     !== undefined) _pPage     = opts.page;
    if (opts.pageSize !== undefined) { _pPageSize = opts.pageSize; _pPage = 0; }

    if (opts.forceRefetch !== false) {
      _pAllEntries = [];
      const UR = window.UpperRoom;
      if (UR && typeof UR.listPrayers === 'function') {
        try { _pAllEntries = await UR.listPrayers({ limit: 500 }) || []; }
        catch (err) { console.warn('[Sanctuary] prayers fetch', err); }
      }
    }

    const total  = _pAllEntries.length;
    const pages  = Math.max(1, Math.ceil(total / _pPageSize));
    _pPage       = Math.min(_pPage, pages - 1);
    const start  = _pPage * _pPageSize;
    const slice  = _pAllEntries.slice(start, start + _pPageSize);
    const end    = Math.min(start + _pPageSize, total);

    const pageSizeOpts = [25, 50, 75, 100].map(n =>
      `<option value="${n}"${n === _pPageSize ? ' selected' : ''}>${n}</option>`).join('');

    const paginationBar = total > _pPageSize ? `
      <div class="fc-sct-pagination">
        <button class="fc-sct-pg-btn" onclick="window._pChangePage(${_pPage - 1})" ${_pPage === 0 ? 'disabled' : ''}>&lsaquo; Prev</button>
        <span class="fc-sct-pg-info">${start + 1}&ndash;${end} of ${total}</span>
        <button class="fc-sct-pg-btn" onclick="window._pChangePage(${_pPage + 1})" ${_pPage >= pages - 1 ? 'disabled' : ''}>Next &rsaquo;</button>
      </div>` : '';

    pane.innerHTML = `
      <div class="fc-sct-section">
        <div class="fc-sct-compose">
          <textarea class="fc-sct-compose-text" id="fc-sct-ptext" placeholder="Write a prayer request, a praise, or an intercession\u2026"></textarea>
          <div class="fc-sct-compose-footer">
            <label class="fc-sct-priv-label"><input type="checkbox" id="fc-sct-ppriv" checked><span>Keep private</span></label>
            <button class="fc-sct-save-btn" onclick="window._savePrayer()">Save Prayer</button>
          </div>
        </div>
        ${total > 0 ? `
        <div class="fc-sct-list-header">
          <span class="fc-sct-list-count">${total} pra${total === 1 ? 'yer' : 'yers'}</span>
          <label class="fc-sct-per-page">
            Per page:
            <select class="fc-sct-per-page-sel" onchange="window._pChangePageSize(+this.value)">${pageSizeOpts}</select>
          </label>
        </div>` : ''}
        <div class="fc-sct-list" id="fc-sct-plist">
          ${slice.length ? slice.map(e => _sctPrayerEntryHTML(e)).join('') : '<div class="fc-sct-empty">No prayer entries yet. Write your first one above.</div>'}
        </div>
        ${paginationBar}
      </div>`;
  }

  window._pChangePage = function(page) {
    const pane = document.getElementById('fc-sct-pane');
    if (pane) _sctPrayers(pane, { page, forceRefetch: false });
  };

  window._pChangePageSize = function(size) {
    const pane = document.getElementById('fc-sct-pane');
    if (pane) _sctPrayers(pane, { pageSize: size, forceRefetch: false });
  };

  function _sctPrayerEntryHTML(e) {
    const bodyText  = e.prayerText || e['Prayer Text'] || e.text || '';
    const dateTs    = e.submittedAt || e['Submitted At'] || e.createdAt || null;
    const date      = _sctDate(dateTs);
    const confRaw   = e.isConfidential !== undefined ? e.isConfidential : e['Is Confidential'];
    const isPrivate = confRaw === 'TRUE' || confRaw === true;
    const isPublished = !!e.published;
    return `
      <div class="fc-sct-entry" data-entry-id="${_e(e.id)}" data-prayer-text="${_e(bodyText)}">
        <div class="fc-sct-entry-meta">
          <span class="fc-sct-entry-date">${date}</span>
          <span class="fc-sct-badge ${isPrivate ? 'private' : 'shared'}">${isPrivate ? 'Private' : 'Shared'}</span>
          <button class="fc-sct-entry-edit" title="Edit" onclick="window._editPrayer('${_e(e.id)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${isPublished
            ? '<span class="fc-sct-badge published">Shared to Prayer Chain \u2713</span>'
            : `<button class="fc-sct-publish-btn" onclick="window._publishPrayer('${_e(e.id)}')">Share to Prayer Chain</button>`}
          <button class="fc-sct-entry-del" title="Delete" onclick="window._confirmPrayerDelete('${_e(e.id)}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div class="fc-sct-entry-text">${_e(bodyText)}</div>
      </div>`;
  }

  window._editPrayer = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card || card.querySelector('.fc-sct-edit-area')) return;
    const bodyText = card.dataset.prayerText || '';
    const textEl = card.querySelector('.fc-sct-entry-text');
    if (textEl) textEl.style.display = 'none';
    const editEl = document.createElement('div');
    editEl.className = 'fc-sct-edit-block';
    editEl.innerHTML = `
      <textarea class="fc-sct-edit-area" rows="5">${_e(bodyText)}</textarea>
      <div class="fc-sct-edit-actions">
        <button class="fc-sct-edit-cancel" onclick="window._cancelPrayerEdit('${_e(id)}')">Cancel</button>
        <button class="fc-sct-edit-save" onclick="window._savePrayerEdit('${_e(id)}')">Save</button>
      </div>`;
    card.appendChild(editEl);
    editEl.querySelector('textarea').focus();
  };

  window._cancelPrayerEdit = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    const textEl = card.querySelector('.fc-sct-entry-text');
    if (textEl) textEl.style.display = '';
    const editEl = card.querySelector('.fc-sct-edit-block');
    if (editEl) editEl.remove();
  };

  window._savePrayerEdit = async function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card) return;
    const ta = card.querySelector('.fc-sct-edit-area');
    if (!ta) return;
    const newText = ta.value.trim();
    if (!newText) return;
    const saveBtn = card.querySelector('.fc-sct-edit-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }
    const UR = window.UpperRoom;
    try {
      if (!UR || typeof UR.updatePrayer !== 'function') throw new Error('UpperRoom unavailable');
      await UR.updatePrayer(id, { prayerText: newText });
    } catch (err) {
      console.error('[Sanctuary] edit prayer', err);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
      return;
    }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) await _sctPrayers(pane);
  };

  window._savePrayer = async function() {
    const ta = document.getElementById('fc-sct-ptext');
    const privCb = document.getElementById('fc-sct-ppriv');
    if (!ta || !_me) return;
    const text = (ta.value || '').trim();
    if (!text) return;
    const btn = document.querySelector('#fc-sct-pane .fc-sct-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
    const UR = window.UpperRoom;
    try {
      if (!UR || typeof UR.createPrayer !== 'function') throw new Error('UpperRoom unavailable');
      await UR.createPrayer({
        prayerText:        text,
        submitterName:     _me.name || _me.email,
        submitterEmail:    _me.email,
        isConfidential:    (privCb && privCb.checked) ? 'TRUE' : 'FALSE',
        followUpRequested: 'FALSE',
      });
      ta.value = '';
    } catch (err) {
      console.error('[Sanctuary] save prayer', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Save Prayer'; }
      return;
    }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) { _pPage = 0; await _sctPrayers(pane); }
  };

  window._publishPrayer = async function(id) {
    if (!id || !_db || !_me) return;
    const entryEl = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    const text = entryEl ? (entryEl.dataset.prayerText || '') : '';
    const UR = window.UpperRoom;
    try {
      // Post to the Prayer Chain conversation
      await _db.collection('conversations').doc('prayer').collection('messages').add({
        text,
        authorName:  _me.name || _me.email,
        author:      _me.uid,
        authorEmail: _me.email,
        timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
      });
      // Mark the prayer record as published
      if (UR && typeof UR.updatePrayer === 'function') {
        await UR.updatePrayer(id, { published: true, publishedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    } catch (err) { console.error('[Sanctuary] publish prayer', err); return; }
    const pane = document.getElementById('fc-sct-pane');
    if (pane) await _sctPrayers(pane);  // keep current page after publish
  };

  window._confirmPrayerDelete = function(id) {
    const card = document.querySelector(`.fc-sct-entry[data-entry-id="${id}"]`);
    if (!card || card.querySelector('.fc-sct-del-confirm')) return;
    const delBtn = card.querySelector('.fc-sct-entry-del');
    if (delBtn) delBtn.style.visibility = 'hidden';
    const row = document.createElement('span');
    row.className = 'fc-sct-del-confirm';
    row.innerHTML = `<span class="fc-sct-del-label">Delete?</span>
      <button class="fc-sct-del-yes" onclick="window._executePrayerDelete('${_e(id)}')">Yes</button>
      <button class="fc-sct-del-no" onclick="window._cancelDeleteConfirm('${_e(id)}')">No</button>`;
    const meta = card.querySelector('.fc-sct-entry-meta');
    if (meta) meta.appendChild(row);
  };

  window._executePrayerDelete = async function(id) {
    if (!id) return;
    const UR = window.UpperRoom;
    try {
      if (UR && typeof UR.deletePrayer === 'function') {
        await UR.deletePrayer(id);
      } else if (_db) {
        await _db.collection('prayers').doc(id).delete();
      }
    } catch (err) { console.error('[Sanctuary] delete prayer', err); return; }
    const pane = document.getElementById('fc-sct-pane');
    if (pane && _sanctuaryTab === 'prayers') await _sctPrayers(pane);  // keep current page
  };

  // _deletePrayer kept for legacy callers
  window._deletePrayer = window._executePrayerDelete;

  /* Today's Word tab */
  async function _sctWord(pane) {
    // Build last-7-days YYYY-MM-DD list (oldest → newest, so newest scrolls to bottom)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    let allRows = [], prefs = {};
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listAppContent === 'function')
        allRows = await UR.listAppContent('devotionals', { skipDateFilter: true }) || [];
      if (UR && typeof UR.getUserPreferences === 'function')
        prefs = await UR.getUserPreferences() || {};
    } catch (err) { console.warn('[Sanctuary] devotional fetch', err); }

    // Match each day to a devotional row
    const matched = days.map(d => ({
      key: d,
      row: allRows.find(r => _sctNorm(r.date || r.Date || '') === d) || null,
    })).filter(x => x.row);

    if (!matched.length) {
      pane.innerHTML = `
        <div class="fc-sct-section">
          <div class="fc-sct-word-empty">
            <div class="fc-sct-word-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
            </div>
            <p>No devotionals found for the past 7 days.</p>
            <a class="fc-sct-grow-link" href="../app.grow/app.grow.html">Open GROW \u2192</a>
          </div>
        </div>`;
      return;
    }

    const today     = _sctToday();
    const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

    function _dayLabel(key) {
      if (key === today)     return 'Today';
      if (key === yesterday) return 'Yesterday';
      const d = new Date(key + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    function _wordBubble({ key, row }) {
      const title      = row.title      || row.Title      || 'Daily Reflection';
      const theme      = row.theme      || row.Theme      || '';
      const scripture  = row.scripture  || row.Scripture  || '';
      const reflection = row.reflection || row.Reflection || '';
      const question   = row.question   || row.Question   || '';
      const prayer     = row.prayer     || row.Prayer     || '';
      const isToday    = key === today;
      const done       = !!prefs['complete_devo_' + key];

      return `
        <div class="fc-sct-day-sep">${_dayLabel(key)}</div>
        <div class="fc-sct-word-msg${isToday ? ' fc-sct-word-today' : ''}">
          <div class="fc-sct-word-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          </div>
          <div class="fc-sct-word-bubble">
            <div class="fc-sct-word-bubble-sender">FlockOS \u2022 Today\u2019s Word</div>
            <div class="fc-sct-word-bubble-title">${_e(title)}</div>
            ${theme      ? `<div class="fc-sct-word-bubble-theme">${_e(theme)}</div>` : ''}
            ${scripture  ? `<div class="fc-sct-word-bubble-scripture">${_e(scripture)}</div>` : ''}
            ${reflection ? `<div class="fc-sct-word-bubble-section"><span class="fc-sct-word-bubble-label">Reflection</span><p>${_e(reflection)}</p></div>` : ''}
            ${question   ? `<div class="fc-sct-word-bubble-section fc-sct-word-bubble-q"><span class="fc-sct-word-bubble-label">Reflect</span><p>${_e(question)}</p></div>` : ''}
            ${prayer     ? `<div class="fc-sct-word-bubble-section fc-sct-word-bubble-p"><span class="fc-sct-word-bubble-label">Prayer</span><p>${_e(prayer)}</p></div>` : ''}
            <div class="fc-sct-bubble-actions">
              <button class="fc-sct-complete-btn${done ? ' done' : ''}" onclick="window._sctCompleteDevo('${key}',this)">${done ? '\u2713 Completed' : 'Mark Complete'}</button>
              <button class="fc-sct-reply-btn" onclick="window._sctReplyOpen('devo','${key}')">+ Add Note</button>
            </div>
            <div class="fc-sct-reply-block" id="fc-sct-reply-devo-${key}" data-title="${_e(title)}" style="display:none">
              <textarea class="fc-sct-reply-area" placeholder="Write your reflection for your journal..." rows="3"></textarea>
              <div class="fc-sct-reply-actions">
                <button class="fc-sct-reply-save" onclick="window._sctReplySave('devo','${key}')">Save to Journal</button>
                <button class="fc-sct-reply-cancel" onclick="window._sctReplyCancel('devo','${key}')">Cancel</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    pane.innerHTML = `
      <div class="fc-sct-section fc-sct-word-feed">
        ${matched.map(_wordBubble).join('')}
        <div class="fc-sct-word-footer">
          <a class="fc-sct-grow-link" href="../app.grow/app.grow.html">Open in GROW \u2192</a>
        </div>
      </div>`;

    // Scroll to bottom so today's entry is visible first
    pane.scrollTop = pane.scrollHeight;
  }

  /* Reading tab */
  async function _sctReading(pane) {
    const todayDay = _sctDayOfYear();

    // Build last-7-days as day-of-year list (oldest → newest)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = Math.max(1, todayDay - i);
      days.push(d);
    }

    let allRows = [], prefs = {};
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listAppContent === 'function')
        allRows = await UR.listAppContent('reading', { skipDateFilter: true }) || [];
      if (UR && typeof UR.getUserPreferences === 'function')
        prefs = await UR.getUserPreferences() || {};
    } catch (err) { console.warn('[Sanctuary] reading fetch', err); }

    // Match each day number to a reading row
    const matched = days.map(dayNum => ({
      dayNum,
      row: allRows.find(r => +(r.day || r.Day || 0) === dayNum) || allRows[dayNum - 1] || null,
    })).filter(x => x.row);

    if (!matched.length) {
      pane.innerHTML = `
        <div class="fc-sct-section">
          <div class="fc-sct-word-empty">
            <div class="fc-sct-word-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
            </div>
            <p>No reading plan found for the past 7 days.</p>
            <a class="fc-sct-grow-link" href="../app.grow/app.grow.html">Open GROW \u2192</a>
          </div>
        </div>`;
      return;
    }

    function _dayLabel(dayNum) {
      if (dayNum === todayDay)     return 'Today';
      if (dayNum === todayDay - 1) return 'Yesterday';
      const d = new Date(new Date().getFullYear(), 0, dayNum);
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    function _readBubble({ dayNum, row }) {
      const isToday   = dayNum === todayDay;
      const done      = !!prefs['complete_read_' + dayNum];
      const passages  = [
        { label: 'Old Testament', ref: row.ot || row.OT || row['Old Testament'] || '', color: 'fc-sct-read-ot' },
        { label: 'New Testament', ref: row.nt || row.NT || row['New Testament'] || '', color: 'fc-sct-read-nt' },
        { label: 'Psalms',        ref: row.psalms  || row.Psalms  || row.ps || '', color: 'fc-sct-read-ps' },
        { label: 'Proverbs',      ref: row.proverbs || row.Proverbs || row.pr || '', color: 'fc-sct-read-pr' },
      ].filter(p => p.ref);
      const dayLabel = 'Day ' + +(row.day || row.Day || dayNum);

      return `
        <div class="fc-sct-day-sep">${_dayLabel(dayNum)}</div>
        <div class="fc-sct-word-msg${isToday ? ' fc-sct-word-today' : ''}">
          <div class="fc-sct-word-avatar fc-sct-read-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
          </div>
          <div class="fc-sct-word-bubble">
            <div class="fc-sct-word-bubble-sender">FlockOS \u2022 Reading Plan</div>
            <div class="fc-sct-word-bubble-title">${_e(dayLabel)}</div>
            <div class="fc-sct-passages">
              ${passages.map(p => `
                <div class="fc-sct-passage ${p.color}">
                  <div class="fc-sct-passage-label">${_e(p.label)}</div>
                  <div class="fc-sct-passage-ref">${_e(p.ref)}</div>
                </div>`).join('')}
            </div>
            <div class="fc-sct-bubble-actions">
              <button class="fc-sct-complete-btn fc-sct-complete-read${done ? ' done' : ''}" onclick="window._sctCompleteRead(${dayNum},this)">${done ? '\u2713 Completed' : 'Mark Complete'}</button>
              <button class="fc-sct-reply-btn" onclick="window._sctReplyOpen('read','${dayNum}')">+ Add Note</button>
            </div>
            <div class="fc-sct-reply-block" id="fc-sct-reply-read-${dayNum}" data-title="${_e(dayLabel)}" style="display:none">
              <textarea class="fc-sct-reply-area" placeholder="Write your reading notes for your journal..." rows="3"></textarea>
              <div class="fc-sct-reply-actions">
                <button class="fc-sct-reply-save" onclick="window._sctReplySave('read','${dayNum}')">Save to Journal</button>
                <button class="fc-sct-reply-cancel" onclick="window._sctReplyCancel('read','${dayNum}')">Cancel</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    pane.innerHTML = `
      <div class="fc-sct-section fc-sct-word-feed">
        ${matched.map(_readBubble).join('')}
        <div class="fc-sct-word-footer">
          <a class="fc-sct-grow-link" href="../app.grow/app.grow.html">Open in GROW \u2192</a>
        </div>
      </div>`;

    pane.scrollTop = pane.scrollHeight;
  }

  /* Date / time helpers for sanctuary */
  function _sctToday() {
    const d = new Date(), p = n => n < 10 ? '0' + n : '' + n;
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function _sctNorm(s) {
    if (!s) return '';
    if (s && s.toDate) s = s.toDate();
    if (s instanceof Date) {
      const p = n => n < 10 ? '0' + n : '' + n;
      return s.getFullYear() + '-' + p(s.getMonth() + 1) + '-' + p(s.getDate());
    }
    const str = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
    return str.slice(0, 10);
  }
  function _sctDayOfYear() {
    const now = new Date(), start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }
  function _sctPrettyDate(ymd) {
    if (!ymd) return '';
    const [y, m, d] = String(ymd).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function _sctDate(ts) {
    if (!ts) return '';
    let d = (ts && ts.toDate) ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ── Sanctuary: seen tracking (daily badge) ────────────────────────── */
  function _sctSeenKey() { return 'flock-sct-seen-' + _sctToday(); }
  function _sctSeen() {
    try { return JSON.parse(localStorage.getItem(_sctSeenKey())) || {}; } catch { return {}; }
  }
  function _sctMarkSeen(tab) {
    const seen = _sctSeen();
    if (seen[tab]) return; // already recorded
    seen[tab] = true;
    try { localStorage.setItem(_sctSeenKey(), JSON.stringify(seen)); } catch {}
    // Live-update the pinned badge without full re-render
    const sct = _conversations.find(c => c.id === SANCTUARY_ID);
    if (sct) {
      const n = (seen.word ? 0 : 1) + (seen.reading ? 0 : 1);
      sct.unreadCount = n;
      const bubble = document.querySelector('.fc-pinned-item[data-id="my-sanctuary"] .fc-pinned-bubble');
      if (bubble) {
        let badge = bubble.querySelector('.fc-pinned-badge');
        if (n > 0) {
          if (!badge) { badge = document.createElement('div'); badge.className = 'fc-pinned-badge'; bubble.appendChild(badge); }
          badge.textContent = n;
        } else { if (badge) badge.remove(); }
      }
    }
  }

  /* ── Sanctuary: Complete + Reply global handlers ─────────────────────── */
  window._sctCompleteDevo = async function(key, btn) {
    if (btn.classList.contains('done')) return;
    btn.disabled = true;
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.updateUserPreferences === 'function')
        await UR.updateUserPreferences({ ['complete_devo_' + key]: true });
      btn.textContent = '\u2713 Completed'; btn.classList.add('done');
    } catch (err) { console.warn('[Sanctuary] complete devo failed', err); btn.disabled = false; }
  };

  window._sctCompleteRead = async function(dayNum, btn) {
    if (btn.classList.contains('done')) return;
    btn.disabled = true;
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.updateUserPreferences === 'function')
        await UR.updateUserPreferences({ ['complete_read_' + dayNum]: true });
      btn.textContent = '\u2713 Completed'; btn.classList.add('done');
    } catch (err) { console.warn('[Sanctuary] complete read failed', err); btn.disabled = false; }
  };

  window._sctReplyOpen = function(type, key) {
    const block = document.getElementById('fc-sct-reply-' + type + '-' + key);
    if (!block) return;
    block.style.display = '';
    block.querySelector('.fc-sct-reply-area').focus();
  };

  window._sctReplyCancel = function(type, key) {
    const block = document.getElementById('fc-sct-reply-' + type + '-' + key);
    if (!block) return;
    block.style.display = 'none';
    block.querySelector('.fc-sct-reply-area').value = '';
  };

  window._sctReplySave = async function(type, key) {
    const block = document.getElementById('fc-sct-reply-' + type + '-' + key);
    if (!block) return;
    const title   = block.dataset.title || key;
    const text    = block.querySelector('.fc-sct-reply-area').value.trim();
    if (!text) return;
    const prefix  = type === 'devo'
      ? '\uD83D\uDCD6 Reflection on: ' + title + '\n\n'
      : '\uD83D\uDCDA Reading Notes (' + title + '):\n\n';
    const saveBtn = block.querySelector('.fc-sct-reply-save');
    saveBtn.textContent = 'Saving\u2026'; saveBtn.disabled = true;
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.createJournal === 'function')
        await UR.createJournal({ entry: prefix + text });
      block.style.display = 'none';
      block.querySelector('.fc-sct-reply-area').value = '';
    } catch (err) {
      console.warn('[Sanctuary] reply save failed', err);
      saveBtn.textContent = 'Save to Journal'; saveBtn.disabled = false;
    }
  };

  /* ── Recent Sermons Feed ─────────────────────────────────────────────── */

  let _srmPage         = 0;
  let _srmAllRows      = [];
  let _srmBadgeChecked = false;
  const SRM_PAGE_SIZE  = 12;

  // ── Badge helpers ──────────────────────────────────────────────────────
  function _srmSeenKey()    { return 'flock-srm-latest-id'; }
  function _srmGetSeenId()  { try { return localStorage.getItem(_srmSeenKey()) || ''; } catch { return ''; } }
  function _srmSetSeenId(id){ try { localStorage.setItem(_srmSeenKey(), id || ''); } catch {} }

  function _srmUpdateBadge(n) {
    const entry = _conversations.find(c => c.id === SERMONS_ID);
    if (entry) entry.unreadCount = n;
    const bubble = document.querySelector(`.fc-pinned-item[data-id="${SERMONS_ID}"] .fc-pinned-bubble`);
    if (!bubble) return;
    let badge = bubble.querySelector('.fc-pinned-badge');
    if (n > 0) {
      if (!badge) { badge = document.createElement('div'); badge.className = 'fc-pinned-badge'; bubble.appendChild(badge); }
      badge.textContent = n > 9 ? '9+' : String(n);
    } else {
      badge?.remove();
    }
  }

  async function _srmCheckNewBadge() {
    if (_srmBadgeChecked) return;
    _srmBadgeChecked = true;
    const UR = window.UpperRoom;
    if (!UR || typeof UR.listSermons !== 'function') return;
    try {
      const all = await UR.listSermons({ limit: 50 }) || [];
      const preached = all.filter(r => ['preached','delivered'].includes((r.status||'').toLowerCase()));
      if (!preached.length) return;
      const seenId  = _srmGetSeenId();
      const seenIdx = preached.findIndex(r => r.id === seenId);
      // seenIdx === -1 → never seen (all new); === 0 → fully current; > 0 → that many new
      const newCount = seenIdx === -1 ? preached.length : seenIdx;
      if (newCount > 0) _srmUpdateBadge(Math.min(newCount, 9));
    } catch (err) {
      console.warn('[Sermons] badge check failed', err);
    }
  }

  async function _renderSermons(container) {
    container.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';
    _srmAllRows = [];
    try {
      const UR = window.UpperRoom;
      if (UR && typeof UR.listSermons === 'function') {
        // Fetch broadly then client-filter for any "preached" status variant
        const all = await UR.listSermons({ limit: 200 }) || [];
        _srmAllRows = all.filter(r => {
          const s = (r.status || '').toLowerCase();
          return s === 'preached' || s === 'delivered';
        });
      }
    } catch (err) {
      console.warn('[Sermons] fetch failed', err);
    }
    // Mark all as seen and clear badge
    if (_srmAllRows.length > 0) {
      _srmSetSeenId(_srmAllRows[0].id);
      _srmUpdateBadge(0);
    }
    _srmPage = 0;
    _renderSermonPage(container);
  }

  function _renderSermonPage(container) {
    const total = _srmAllRows.length;
    if (total === 0) {
      container.innerHTML = `
        <div class="fc-sct-section">
          <div class="fc-sct-word-empty">
            <div class="fc-sct-word-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
            <p>No preached sermons found yet.</p>
          </div>
        </div>`;
      return;
    }
    const pages = Math.max(1, Math.ceil(total / SRM_PAGE_SIZE));
    _srmPage = Math.min(_srmPage, pages - 1);
    const start = _srmPage * SRM_PAGE_SIZE;
    const slice = _srmAllRows.slice(start, start + SRM_PAGE_SIZE);
    const pagBar = pages > 1 ? `
      <div class="fc-sct-pagination">
        <button class="fc-sct-pg-btn" ${_srmPage === 0 ? 'disabled' : ''} onclick="window._srmChangePage(${_srmPage - 1})">&#8592; Prev</button>
        <span class="fc-sct-pg-info">${_srmPage + 1} / ${pages}</span>
        <button class="fc-sct-pg-btn" ${_srmPage >= pages - 1 ? 'disabled' : ''} onclick="window._srmChangePage(${_srmPage + 1})">Next &#8594;</button>
      </div>` : '';
    container.innerHTML = `
      <div class="fc-sct-section fc-srm-feed">
        ${slice.map(_sermonBubble).join('')}
        ${pagBar}
      </div>`;
  }

  window._srmChangePage = function(page) {
    const container = $('fc-messages');
    if (!container) return;
    _srmPage = page;
    _renderSermonPage(container);
    container.scrollTop = 0;
  };

  /* ── Sermon helper: parse a raw date value → human string ── */
  function _srmDate(raw) {
    if (!raw) return '';
    try {
      const d = raw.toDate ? raw.toDate() : new Date(raw);
      return isNaN(d) ? '' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) { return ''; }
  }

  /* ── Sermon helper: build preview (collapsed) bubble header HTML ── */
  function _srmBubbleHeader(s) {
    const title       = _e(s.title || s.Title || 'Untitled Sermon');
    const preacher    = _e(s.preacher || s.preacherName || s.Preacher || s['Preacher Name'] || 'Pastor');
    const dateStr     = _srmDate(s.date || s.Date || s.deliveredAt || s.createdAt || '');
    const series      = _e(s.seriesTitle || s.seriesName || s.series || s.Series || '');
    const serviceType = _e(s.serviceType || s['Service Type'] || '');
    return `
      <div class="fc-sct-word-bubble-sender">FlockOS &bull; Sermon</div>
      <div class="fc-srm-title">${title}</div>
      <div class="fc-srm-meta-row">
        <span class="fc-srm-preacher">${preacher}</span>
        ${dateStr ? `<span class="fc-srm-dot">&middot;</span><span class="fc-srm-date">${dateStr}</span>` : ''}
      </div>
      ${serviceType ? `<div class="fc-srm-service-pill">${serviceType}</div>` : ''}
      ${series ? `<div class="fc-srm-series-pill">Series &bull; ${series}</div>` : ''}`;
  }

  /* ── Sermon section renderer (used in expanded view) ── */
  function _srmSection(sec, idx) {
    const type    = sec.type || 'point';
    const heading = _e(sec.title || sec.heading || {
      intro: 'Introduction', scripture: 'Scripture', point: 'Main Point',
      illustration: 'Illustration', explanation: 'Explanation',
      application: 'Application', prayer: 'Prayer',
      conclusion: 'Conclusion', transition: ''
    }[type] || '');
    const notes = _e(sec.notes || sec.body || '');
    const ref   = _e(sec.scriptureRef || sec.reference || '');

    if (type === 'transition') {
      return `<div class="fc-srm-section-sep"></div>`;
    }
    if (type === 'scripture') {
      return `
        <div class="fc-srm-section fc-srm-sec-scripture">
          ${heading ? `<div class="fc-srm-sec-label">${heading}</div>` : ''}
          ${ref ? `<div class="fc-srm-sec-ref">${ref}</div>` : ''}
          ${notes ? `<div class="fc-srm-sec-text">${notes}</div>` : ''}
        </div>`;
    }
    if (type === 'prayer') {
      return `
        <div class="fc-srm-section fc-srm-sec-prayer">
          <div class="fc-srm-sec-label">&#9901; ${heading || 'Prayer'}</div>
          ${notes ? `<div class="fc-srm-sec-text">${notes}</div>` : ''}
        </div>`;
    }
    if (type === 'illustration') {
      return `
        <div class="fc-srm-section fc-srm-sec-illustration">
          ${heading ? `<div class="fc-srm-sec-label">${heading}</div>` : ''}
          ${notes ? `<div class="fc-srm-sec-text fc-srm-sec-italic">${notes}</div>` : ''}
        </div>`;
    }
    if (type === 'application') {
      return `
        <div class="fc-srm-section fc-srm-sec-application">
          ${heading ? `<div class="fc-srm-sec-label">&#10003; ${heading}</div>` : ''}
          ${notes ? `<div class="fc-srm-sec-text">${notes}</div>` : ''}
        </div>`;
    }
    if (type === 'point') {
      return `
        <div class="fc-srm-section fc-srm-sec-point">
          ${heading ? `<div class="fc-srm-sec-point-heading"><span class="fc-srm-sec-point-num">${idx + 1}</span>${heading}</div>` : ''}
          ${notes ? `<div class="fc-srm-sec-text">${notes}</div>` : ''}
        </div>`;
    }
    // intro / explanation / conclusion / default
    return `
      <div class="fc-srm-section fc-srm-sec-default">
        ${heading ? `<div class="fc-srm-sec-label">${heading}</div>` : ''}
        ${notes ? `<div class="fc-srm-sec-text">${notes}</div>` : ''}
      </div>`;
  }

  /* ── Build collapsed sermon bubble ── */
  function _sermonBubble(s) {
    const sid = s.id || '';
    return `
      <div class="fc-sct-word-msg fc-srm-msg">
        <div class="fc-sct-word-avatar fc-srm-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="fc-sct-word-bubble fc-srm-bubble" id="fc-srm-b-${_e(sid)}">
          <div class="fc-srm-accent-bar"></div>
          <div class="fc-srm-body">
            ${_srmBubbleHeader(s)}
            <button class="fc-srm-view-btn" onclick="window._srmExpand('${_e(sid)}')">Click to View &nbsp;&#9660;</button>
          </div>
        </div>
      </div>`;
  }

  /* ── Expand a sermon bubble ── */
  window._srmExpand = function(sid) {
    const s = _srmAllRows.find(r => r.id === sid);
    if (!s) return;

    const scripture = _e(s.scriptureRefs || s.scripture || s.passageRef || s['Scripture Refs'] || s.Scripture || '');
    const summary   = _e(s.summary || s.Summary || s.description || '');
    const sections  = Array.isArray(s.sections) ? s.sections : [];
    const altarCall = _e(s.altarCall || s.altar_call || '');
    const rawTags   = Array.isArray(s.topicTags) ? s.topicTags
                      : (s['Topic Tags'] ? String(s['Topic Tags']).split(',') : []);
    const tags      = rawTags.map(t => t.trim()).filter(Boolean);

    // Count only 'point' sections for numbering
    let pointIdx = 0;
    const sectionsHtml = sections.map(sec => {
      const html = _srmSection(sec, sec.type === 'point' ? pointIdx : 0);
      if (sec.type === 'point') pointIdx++;
      return html;
    }).join('');

    const altarHtml = altarCall ? `
      <div class="fc-srm-section fc-srm-sec-altar">
        <div class="fc-srm-sec-label">&#9829; Altar Call</div>
        <div class="fc-srm-sec-text">${altarCall}</div>
      </div>` : '';

    const body = document.getElementById('fc-srm-b-' + sid)?.querySelector('.fc-srm-body');
    if (!body) return;
    body.innerHTML = `
      ${_srmBubbleHeader(s)}
      ${scripture ? `<div class="fc-srm-scripture">${scripture}</div>` : ''}
      ${summary ? `<div class="fc-srm-summary-block"><div class="fc-srm-sec-label">Summary</div><div class="fc-srm-sec-text">${summary}</div></div>` : ''}
      ${sectionsHtml}
      ${altarHtml}
      ${tags.length ? `<div class="fc-srm-tags">${tags.map(t => `<span class="fc-srm-tag">${_e(t)}</span>`).join('')}</div>` : ''}
      <div class="fc-srm-actions">
        <button class="fc-srm-action-btn fc-srm-slides-btn" onclick="window._srmViewSlides('${_e(sid)}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          View Slides
        </button>
        <button class="fc-srm-action-btn fc-srm-journal-btn" onclick="window._srmSaveJournal('${_e(sid)}', this)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Save to Journal
        </button>
      </div>
      <button class="fc-srm-collapse-btn" onclick="window._srmCollapse('${_e(sid)}')">&#9650; Collapse</button>`;
  };

  /* ── Collapse a sermon bubble back ── */
  window._srmCollapse = function(sid) {
    const s = _srmAllRows.find(r => r.id === sid);
    if (!s) return;
    const body = document.getElementById('fc-srm-b-' + sid)?.querySelector('.fc-srm-body');
    if (!body) return;
    body.innerHTML = `
      ${_srmBubbleHeader(s)}
      <button class="fc-srm-view-btn" onclick="window._srmExpand('${_e(sid)}')">Click to View &nbsp;&#9660;</button>`;
  };

  /* ── Save sermon outline to journal ── */
  window._srmSaveJournal = async function(sid, btn) {
    const s = _srmAllRows.find(r => r.id === sid);
    if (!s) return;
    const UR = window.UpperRoom;
    if (!UR || typeof UR.createJournal !== 'function') { _toast('Journal unavailable', 'error'); return; }

    btn.disabled = true; btn.textContent = 'Saving\u2026';

    const dateStr   = _srmDate(s.date || s.Date || '');
    const preacher  = s.preacher || s.preacherName || s.Preacher || s['Preacher Name'] || 'Pastor';
    const series    = s.seriesTitle || s.series || '';
    const scripture = s.scriptureRefs || s.scripture || s.passageRef || '';
    const sections  = Array.isArray(s.sections) ? s.sections : [];
    let text = `\uD83C\uDFDB\uFE0F Sermon Notes\n`;
    text += `\uD83D\uDCD6 ${s.title || 'Untitled Sermon'}\n`;
    if (preacher) text += `Pastor: ${preacher}\n`;
    if (dateStr)  text += `Date: ${dateStr}\n`;
    if (series)   text += `Series: ${series}\n`;
    if (scripture) text += `Scripture: ${scripture}\n`;
    text += '\n';
    let pointNum = 1;
    sections.forEach(sec => {
      const heading = sec.title || sec.heading || '';
      const notes   = sec.notes || sec.body || '';
      if (sec.type === 'transition') { text += '\u2015\n'; return; }
      if (sec.type === 'point') {
        if (heading) text += `\n${pointNum}. ${heading}\n`;
        if (notes)   text += `${notes}\n`;
        pointNum++;
      } else {
        const label = { intro: 'Introduction', scripture: 'Scripture', illustration: 'Illustration',
          explanation: 'Explanation', application: 'Application', prayer: 'Prayer',
          conclusion: 'Conclusion' }[sec.type] || sec.type || '';
        if (label) text += `\n[${label}]${heading ? ' ' + heading : ''}\n`;
        if (notes) text += `${notes}\n`;
      }
    });
    if (s.altarCall) text += `\n[Altar Call]\n${s.altarCall}\n`;

    try {
      await UR.createJournal({ entry: text.trim(), private: false });
      btn.textContent = '\u2713 Saved!';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Save to Journal`; }, 2500);
    } catch (err) {
      console.error('[Sermons] save journal failed', err);
      btn.disabled = false; btn.textContent = 'Try Again';
    }
  };

  /* ── Inline slides viewer ── */
  let _srmSlides  = [];
  let _srmSlideIdx = 0;

  function _buildSermonSlidesArray(s) {
    const slides = [];
    const preacher = s.preacher || s.preacherName || s.Preacher || s['Preacher Name'] || '';
    const dateStr  = _srmDate(s.date || s.Date || '');
    const series   = s.seriesTitle || s.series || '';
    const scripture = s.scriptureRefs || s.scripture || s.passageRef || '';
    // Title slide
    slides.push({ type: 'title', heading: '', text: (s.title || 'Untitled Sermon') + (preacher ? '\n' + preacher : '') });
    // Series / date
    if (series || dateStr) slides.push({ type: 'series', heading: '', text: [series, dateStr].filter(Boolean).join('\n') });
    // Top-level passage
    if (scripture) slides.push({ type: 'scripture', heading: 'Scripture', text: scripture });
    // Sections
    let pointNum = 1;
    (Array.isArray(s.sections) ? s.sections : []).forEach(sec => {
      if (sec.type === 'transition') return;
      const heading = sec.title || sec.heading || ({ intro:'Introduction', scripture:'Scripture', point:'Main Point', illustration:'Illustration', explanation:'Explanation', application:'Application', prayer:'Prayer', conclusion:'Conclusion' }[sec.type] || '');
      const text    = sec.type === 'scripture' ? (sec.scriptureRef || '') + (sec.notes ? '\n' + sec.notes : '') : (sec.notes || sec.body || '');
      if (sec.type === 'point') {
        slides.push({ type: 'point', heading: `${pointNum}. ${heading}`, text });
        pointNum++;
      } else {
        if (heading || text) slides.push({ type: sec.type, heading, text });
      }
    });
    if (s.altarCall && s.altarCall.trim()) slides.push({ type: 'altar', heading: 'Altar Call', text: s.altarCall.trim() });
    return slides;
  }

  window._srmViewSlides = function(sid) {
    const s = _srmAllRows.find(r => r.id === sid);
    if (!s) return;
    _srmSlides   = _buildSermonSlidesArray(s);
    _srmSlideIdx = 0;
    _srmRenderSlideModal();
  };

  function _srmRenderSlideModal() {
    let modal = document.getElementById('fc-srm-slides-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'fc-srm-slides-modal';
      document.body.appendChild(modal);
    }
    const sl    = _srmSlides[_srmSlideIdx] || { type: 'title', heading: '', text: '' };
    const total = _srmSlides.length;
    const typeClass = `fc-srm-slide-${sl.type}`;
    modal.innerHTML = `
      <div class="fc-srm-slide-overlay" onclick="window._srmCloseSlides()"></div>
      <div class="fc-srm-slide-box">
        <div class="fc-srm-slide-topbar">
          <span class="fc-srm-slide-counter">${_srmSlideIdx + 1} / ${total}</span>
          <button class="fc-srm-slide-close" onclick="window._srmCloseSlides()" aria-label="Close">&times;</button>
        </div>
        <div class="fc-srm-slide-stage ${typeClass}">
          ${sl.heading ? `<div class="fc-srm-slide-heading">${_e(sl.heading)}</div>` : ''}
          <div class="fc-srm-slide-text">${_e(sl.text).replace(/\n/g, '<br>')}</div>
        </div>
        <div class="fc-srm-slide-nav">
          <button class="fc-srm-slide-nav-btn" ${_srmSlideIdx === 0 ? 'disabled' : ''} onclick="window._srmSlidePrev()">&#8592;</button>
          <div class="fc-srm-slide-dots">${_srmSlides.map((_, i) => `<span class="fc-srm-slide-dot${i === _srmSlideIdx ? ' active' : ''}" onclick="window._srmSlideGo(${i})"></span>`).join('')}</div>
          <button class="fc-srm-slide-nav-btn" ${_srmSlideIdx >= total - 1 ? 'disabled' : ''} onclick="window._srmSlideNext()">&#8594;</button>
        </div>
      </div>`;
    modal.style.display = 'flex';
    modal.setAttribute('data-srm-id', _srmSlides[0]?.text || '');
    // Keyboard support
    modal._keyHandler = function(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') window._srmSlideNext();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   window._srmSlidePrev();
      if (e.key === 'Escape') window._srmCloseSlides();
    };
    document.addEventListener('keydown', modal._keyHandler);
  }

  window._srmSlideNext = function() {
    if (_srmSlideIdx < _srmSlides.length - 1) { _srmSlideIdx++; _srmRenderSlideModal(); }
  };
  window._srmSlidePrev = function() {
    if (_srmSlideIdx > 0) { _srmSlideIdx--; _srmRenderSlideModal(); }
  };
  window._srmSlideGo = function(i) {
    _srmSlideIdx = i; _srmRenderSlideModal();
  };
  window._srmCloseSlides = function() {
    const modal = document.getElementById('fc-srm-slides-modal');
    if (!modal) return;
    if (modal._keyHandler) document.removeEventListener('keydown', modal._keyHandler);
    modal.style.display = 'none';
  };

  /* ── End of My Sanctuary ────────────────────────────────────────────── */

  function _renderMessages() {
    const msgContainer = $('fc-messages');
    if (!msgContainer) return;

    if (_messages.length === 0) {
      msgContainer.innerHTML = `
        <div class="fc-empty">
          <div class="fc-empty-icon">💬</div>
          <div class="fc-empty-title">No messages yet</div>
          <div class="fc-empty-text">Start the conversation!</div>
        </div>
      `;
      return;
    }

    msgContainer.innerHTML = _messages.map(m => {
      const isMine = m.author === _me.uid;
      const dir = isMine ? 'sent' : 'received';
      const time = _formatTime(m.timestamp);
      
      // Get author info
      const authorName = m.authorName || 'Unknown';
      const authorInitials = _initials(authorName);

      // Special card types
      if (m.type === 'prayer') {
        return `
          <div class="fc-card">
            <div class="fc-card-header">
              <span class="fc-card-icon">🙏</span>
              <span class="fc-card-author">${_e(authorName)}</span>
              <span class="fc-card-time">${time}</span>
              ${_meIsAllAccess ? `<button class="fc-msg-admin-del" onclick="window._adminDeleteMessage('${_e(m.id)}')" title="Delete message">🗑</button>` : ''}
            </div>
            <div class="fc-card-text">${_e(m.text)}</div>
            <button class="fc-card-btn" onclick="window._prayFor('${m.id}')">
              🙏 I'm Praying ${m.prayerCount > 0 ? `(${m.prayerCount})` : ''}
            </button>
          </div>
        `;
      }

      if (m.type === 'announcement') {
        return `
          <div class="fc-card announcement">
            <div class="fc-card-header">
              <span class="fc-card-icon">📢</span>
              <span class="fc-card-author">${_e(authorName)}</span>
              <span class="fc-card-time">${time}</span>
              ${_meIsAllAccess ? `<button class="fc-msg-admin-del" onclick="window._adminDeleteMessage('${_e(m.id)}')" title="Delete message">🗑</button>` : ''}
            </div>
            <div class="fc-card-text">${_e(m.text)}</div>
          </div>
        `;
      }

      // Regular message bubble
      return `
        <div class="fc-message ${dir}">
          ${!isMine ? `<div class="fc-avatar">${authorInitials}</div>` : ''}
          <div class="fc-bubble">
            ${!isMine ? `<div class="fc-message-author">${_e(authorName)}</div>` : ''}
            <div class="fc-message-text">${_e(m.text)}</div>
            <div class="fc-message-time">${time}</div>
          </div>
          ${_meIsAllAccess && !isMine ? `<button class="fc-msg-admin-del" onclick="window._adminDeleteMessage('${_e(m.id)}')" title="Delete message">🗑</button>` : ''}
        </div>
      `;
    }).join('');
  }

  function _scrollToBottom() {
    const msgContainer = $('fc-messages');
    if (!msgContainer) return;
    setTimeout(() => {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }, 100);
  }

  /* ── Admin: Delete Any Message ──────────────────────────────────────── */
  window._adminDeleteMessage = async function(msgId) {
    if (!_meIsAllAccess || !_activeConvId || !msgId) return;
    if (!confirm('Delete this message for everyone?')) return;
    try {
      await _db.collection('conversations').doc(_activeConvId)
        .collection('messages').doc(msgId).delete();
      _toast('Message deleted', 'success');
    } catch (err) {
      console.error('[FlockChat] Admin delete failed:', err);
      _toast('Failed to delete message', 'error');
    }
  };

  /* ── Reactions System ───────────────────────────────────────────────── */
  const REACTION_EMOJIS = ['❤️', '👍', '🙏', '😊', '🎉', '👏', '🔥', '💯'];

  window._showReactionPicker = function(msgId) {
    // Remove existing picker if any
    const existing = document.querySelector('.fc-reaction-picker');
    if (existing) existing.remove();

    // Find message element
    const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!msgEl) return;

    // Create picker
    const picker = document.createElement('div');
    picker.className = 'fc-reaction-picker';
    picker.innerHTML = REACTION_EMOJIS.map(emoji => 
      `<button class="fc-reaction-picker-btn" onclick="window._addReaction('${msgId}', '${emoji}'); this.parentElement.remove();">${emoji}</button>`
    ).join('');

    // Position near message
    msgEl.style.position = 'relative';
    msgEl.appendChild(picker);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeReactionPicker(e) {
        if (!picker.contains(e.target) && !e.target.classList.contains('fc-reaction-add-btn')) {
          picker.remove();
          document.removeEventListener('click', closeReactionPicker);
        }
      });
    }, 100);
  };

  window._addReaction = async function(msgId, emoji) {
    if (!_activeConvId || !msgId) return;
    try {
      const msgRef = _db.collection('conversations').doc(_activeConvId)
        .collection('messages').doc(msgId);
      await msgRef.update({
        [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(_me.uid)
      });
    } catch (err) {
      console.error('[FlockChat] Add reaction failed:', err);
      _toast('Failed to add reaction', 'error');
    }
  };

  window._toggleReaction = async function(msgId, emoji) {
    if (!_activeConvId || !msgId) return;
    try {
      const msg = _messages.find(m => m.id === msgId);
      if (!msg) return;
      
      const reactions = msg.reactions || {};
      const users = reactions[emoji] || [];
      const hasReacted = users.includes(_me.uid);

      const msgRef = _db.collection('conversations').doc(_activeConvId)
        .collection('messages').doc(msgId);
      
      if (hasReacted) {
        // Remove reaction
        await msgRef.update({
          [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(_me.uid)
        });
      } else {
        // Add reaction
        await msgRef.update({
          [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(_me.uid)
        });
      }
    } catch (err) {
      console.error('[FlockChat] Toggle reaction failed:', err);
      _toast('Failed to update reaction', 'error');
    }
  };

  /* ── Admin: Channel Manager ─────────────────────────────────────────── */
  // Cache uid → { name, email } to avoid redundant Firestore reads
  const _userCache = {};
  let _allUsersCache = null; // all church users loaded once per session
  let _mgrSelected = new Set(); // UIDs checked in the add-members picker

  async function _fetchUserName(uid) {
    if (_userCache[uid]) return _userCache[uid];
    try {
      const snap = await _db.collection('users').doc(uid).get();
      const d = snap.exists ? snap.data() : {};
      const entry = { name: d.displayName || d.email || uid, email: d.email || '' };
      _userCache[uid] = entry;
      return entry;
    } catch { return { name: uid, email: '' }; }
  }

  async function _loadAllUsers() {
    if (_allUsersCache) return _allUsersCache;
    try {
      // Source of truth = The Fold (members collection).
      // users collection accumulates auth duplicates — never use it as a roster.
      const [membersSnap, usersSnap] = await Promise.all([
        _db.collection('members').orderBy('lastName').get(),
        _db.collection('users').limit(1000).get()
      ]);
      // Build email → auth UID map
      const emailToUid = new Map();
      usersSnap.forEach(doc => {
        const email = (doc.data().email || '').toLowerCase();
        if (email && !emailToUid.has(email)) emailToUid.set(email, doc.id);
      });
      const myEmail = (_me?.email || '').toLowerCase();
      const byEmail = new Map();
      membersSnap.forEach(doc => {
        const m = doc.data() || {};
        const pin = doc.id;
        // Skip inactive / archived
        const ms = String(m.membershipStatus || '').toLowerCase();
        const st = String(m.status || '').toLowerCase();
        if (ms === 'archived' || st === 'inactive' || st === 'archived') return;
        const first = m.firstName || '';
        const last  = m.lastName  || '';
        const name  = m.displayName || m.name || (first + ' ' + last).trim() || m.primaryEmail || m.email || 'Unknown';
        const email = (m.primaryEmail || m.email || '').toLowerCase();
        if (email && email === myEmail) return; // skip self
        const key = email || pin;
        if (byEmail.has(key)) return; // dedupe
        const uid = emailToUid.get(email) || null;
        if (!uid || uid === _me?.uid) return; // skip if no auth account or self
        byEmail.set(key, { uid, name, email, pin });
        _userCache[uid] = { name, email };
      });
      _allUsersCache = Array.from(byEmail.values())
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn('[FlockChat] Failed to load members for manager:', err);
      _allUsersCache = [];
    }
    return _allUsersCache;
  }

  window._openChannelManager = async function() {
    if (!_meIsAllAccess || !_activeConvId) return;
    const overlay = $('fc-mgr-overlay');
    const drawer  = $('fc-mgr-drawer');
    const title   = $('fc-mgr-title');
    const body    = $('fc-mgr-body');
    if (!overlay || !drawer || !body) return;

    const conv = _conversations.find(c => c.id === _activeConvId);
    if (title) title.textContent = `Manage: ${conv?.name || _activeConvId}`;
    body.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';

    overlay.removeAttribute('hidden');
    drawer.removeAttribute('hidden');
    _mgrSelected.clear();

    try {
      const [snap, allUsers] = await Promise.all([
        _db.collection('conversations').doc(_activeConvId).get(),
        _loadAllUsers()
      ]);

      const data    = snap.exists ? snap.data() : {};
      const members    = data.members        || [];
      const banned     = data.bannedMembers  || [];
      const accessMode = data.accessMode     || 'open';

      // Fetch display names for current members and banned
      const [memberUsers, bannedUsers] = await Promise.all([
        Promise.all(members.map(uid => _fetchUserName(uid).then(u => ({ uid, ...u })))),
        Promise.all(banned.map(uid  => _fetchUserName(uid).then(u => ({ uid, ...u }))))
      ]);

      _renderChannelManager(body, memberUsers, allUsers, bannedUsers, members, banned, accessMode);
    } catch (err) {
      console.error('[FlockChat] Channel manager load failed:', err);
      body.innerHTML = `<div class="fc-mgr-empty">Failed to load channel data.</div>`;
    }
  };

  window._closeChannelManager = function() {
    $('fc-mgr-overlay')?.setAttribute('hidden', '');
    $('fc-mgr-drawer')?.setAttribute('hidden', '');
    _mgrSelected.clear();
  };

  window._setChannelMode = async function(mode) {
    if (!_meIsAllAccess || !_activeConvId) return;
    try {
      await _db.collection('conversations').doc(_activeConvId).update({ accessMode: mode });
      // Refresh manager to reflect new mode
      window._openChannelManager();
    } catch (err) {
      console.error('[FlockChat] Failed to set channel mode:', err);
      _toast('Failed to update channel mode.', 'error');
    }
  };

  function _renderChannelManager(body, memberUsers, allUsers, bannedUsers, memberUids, bannedUids, accessMode) {
    accessMode = accessMode || 'open';
    let html = '';

    // ── Access mode toggle ──
    html += `
      <div style="padding:14px 20px 0;">
        <div class="fc-mgr-mode-row">
          <button class="fc-mgr-mode-btn${accessMode === 'open' ? ' active' : ''}"
                  onclick="window._setChannelMode('open')">🌐 Open</button>
          <button class="fc-mgr-mode-btn${accessMode === 'private' ? ' active' : ''}"
                  onclick="window._setChannelMode('private')">🔒 Private</button>
        </div>
        <div class="fc-mgr-mode-desc">
          ${accessMode === 'open'
            ? 'All church members can see and join this channel.'
            : 'Only added members can see this channel.'}
        </div>
      </div>`;

    // ── Current members ──
    html += `<div class="fc-mgr-section" style="margin-top:10px">Current Members ${memberUids.length > 0 ? `<span style="font-weight:400;text-transform:none;font-size:0.8rem;opacity:0.7">(${memberUids.length})</span>` : ''}</div>`;
    if (memberUsers.length === 0) {
      html += `<div class="fc-mgr-empty">${accessMode === 'private' ? 'No members added yet — channel is hidden from all.' : 'No explicit members. Channel is open to all.'}</div>`;
    } else {
      memberUsers.forEach(u => {
        html += `
          <div class="fc-mgr-member">
            <div class="fc-mgr-avatar">${_initials(u.name)}</div>
            <div class="fc-mgr-member-info">
              <div class="fc-mgr-member-name">${_e(u.name)}</div>
              <div class="fc-mgr-member-sub">${u.pin ? 'PIN ' + _e(u.pin) : _e(u.email || '')}</div>
            </div>
            <button class="fc-mgr-ban-btn"
                    onclick="window._adminRemoveFromChannel('${_e(u.uid)}','${_e(u.name)}')">
              Remove
            </button>
          </div>`;
      });
    }

    // ── Add members picker ──
    const addable = allUsers.filter(u => !memberUids.includes(u.uid) && !bannedUids.includes(u.uid));
    html += `
      <div class="fc-mgr-section" style="margin-top:10px">Add Members</div>
      <div style="padding:6px 20px 8px; display:flex; gap:8px; align-items:center;">
        <input id="fc-mgr-search" class="fc-mgr-search" type="search"
               placeholder="Search by name or email…"
               oninput="window._filterMgrList(this)">
      </div>
      <div class="fc-mgr-user-list" id="fc-mgr-user-list">`;

    if (addable.length === 0) {
      html += `<div class="fc-mgr-empty">All users are already members.</div>`;
    } else {
      addable.forEach(u => {
        html += `
          <label class="fc-mgr-user-item" data-name="${_e(u.name.toLowerCase())}" data-email="${_e(u.email.toLowerCase())}" data-pin="${_e(u.pin||'')}">
            <input type="checkbox" class="fc-mgr-check"
                   onchange="window._toggleMgrSelect('${_e(u.uid)}')" value="${_e(u.uid)}">
            <div class="fc-mgr-avatar" style="width:32px;height:32px;font-size:0.75rem">${_initials(u.name)}</div>
            <div class="fc-mgr-member-info">
              <div class="fc-mgr-member-name">${_e(u.name)}</div>
              <div class="fc-mgr-member-sub">${u.pin ? 'PIN ' + _e(u.pin) : _e(u.email || '')}</div>
            </div>
          </label>`;
      });
    }
    html += `</div>
      <div style="padding:10px 20px 4px;">
        <button id="fc-mgr-add-btn" class="fc-mgr-add-btn" disabled
                onclick="window._adminAddSelected()">
          Add Members
        </button>
      </div>`;

    // ── Banned members ──
    html += `<div class="fc-mgr-section" style="margin-top:10px">Removed / Banned</div>`;
    if (bannedUsers.length === 0) {
      html += `<div class="fc-mgr-empty">No one has been banned.</div>`;
    } else {
      bannedUsers.forEach(u => {
        html += `
          <div class="fc-mgr-member">
            <div class="fc-mgr-avatar" style="background:linear-gradient(135deg,#3b0d1e,#f43f5e)">${_initials(u.name)}</div>
            <div class="fc-mgr-member-info">
              <div class="fc-mgr-member-name">${_e(u.name)}</div>
              <div class="fc-mgr-member-sub">${u.pin ? 'PIN ' + _e(u.pin) : _e(u.email || '')}</div>
            </div>
            <button class="fc-mgr-restore-btn"
                    onclick="window._adminRestoreMember('${_e(u.uid)}','${_e(u.name)}')">
              Restore
            </button>
          </div>`;
      });
    }

    body.innerHTML = html;
  }

  // Toggle a UID in the selection set and update the Add button
  window._toggleMgrSelect = function(uid) {
    if (_mgrSelected.has(uid)) _mgrSelected.delete(uid);
    else _mgrSelected.add(uid);
    const btn = $('fc-mgr-add-btn');
    if (btn) {
      const n = _mgrSelected.size;
      btn.textContent = n > 0 ? `Add ${n} Member${n !== 1 ? 's' : ''}` : 'Add Members';
      btn.disabled = n === 0;
    }
  };

  // Filter the user checklist based on search input
  window._filterMgrList = function(input) {
    const q = input.value.toLowerCase();
    document.querySelectorAll('#fc-mgr-user-list .fc-mgr-user-item').forEach(el => {
      const match = (el.dataset.name || '').includes(q) || (el.dataset.email || '').includes(q);
      el.style.display = match ? '' : 'none';
    });
  };

  // Commit the selected UIDs to the members array
  window._adminAddSelected = async function() {
    const uids = [..._mgrSelected];
    if (!uids.length || !_activeConvId) return;
    const btn = $('fc-mgr-add-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    try {
      await _db.collection('conversations').doc(_activeConvId).update({
        members: firebase.firestore.FieldValue.arrayUnion(...uids)
      });
      _mgrSelected.clear();
      _toast(`${uids.length} member${uids.length !== 1 ? 's' : ''} added`, 'success');
      // Invalidate users cache so re-renders are fresh
      _allUsersCache = null;
      window._openChannelManager();
    } catch (err) {
      console.error('[FlockChat] Add members failed:', err);
      _toast('Failed to add members', 'error');
      if (btn) { btn.disabled = false; btn.textContent = `Add ${uids.length} Member${uids.length !== 1 ? 's' : ''}`; }
    }
  };

  // Remove someone from the explicit members list
  window._adminRemoveFromChannel = async function(uid, displayName) {
    if (!_meIsAllAccess || !_activeConvId || !uid) return;
    if (!confirm(`Remove ${displayName || uid} from this channel's member list?`)) return;
    try {
      await _db.collection('conversations').doc(_activeConvId).update({
        members: firebase.firestore.FieldValue.arrayRemove(uid)
      });
      _toast(`${displayName || 'Member'} removed from channel`, 'success');
      window._openChannelManager();
    } catch (err) {
      console.error('[FlockChat] Remove member failed:', err);
      _toast('Failed to remove member', 'error');
    }
  };

  window._adminBanMember = async function(uid, displayName) {
    if (!_meIsAllAccess || !_activeConvId || !uid) return;
    if (!confirm(`Ban ${displayName || uid} from this channel?`)) return;
    try {
      await _db.collection('conversations').doc(_activeConvId).update({
        bannedMembers: firebase.firestore.FieldValue.arrayUnion(uid)
      });
      delete _userCache[uid];
      _toast(`${displayName || 'Member'} banned from channel`, 'success');
      window._openChannelManager();
    } catch (err) {
      console.error('[FlockChat] Ban member failed:', err);
      _toast('Failed to ban member', 'error');
    }
  };

  window._adminRestoreMember = async function(uid, displayName) {
    if (!_meIsAllAccess || !_activeConvId || !uid) return;
    try {
      await _db.collection('conversations').doc(_activeConvId).update({
        bannedMembers: firebase.firestore.FieldValue.arrayRemove(uid)
      });
      delete _userCache[uid];
      _toast(`${displayName || 'Member'} restored to channel`, 'success');
      window._openChannelManager();
    } catch (err) {
      console.error('[FlockChat] Restore member failed:', err);
      _toast('Failed to restore member', 'error');
    }
  };

  /* ── Send Message ────────────────────────────────────────────────────── */
  async function _sendMessage() {
    if (!_activeConvId) return;

    const input = $('fc-input');
    const sendBtn = $('fc-send');
    if (!input || !sendBtn) return;

    const text = input.value.trim();
    if (!text) return;

    // Disable while sending
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      const conv = _conversations.find(c => c.id === _activeConvId);

      // Church Announcements: route through UpperRoom so the post lands in
      // the same shared channel that The Announcements view reads/writes.
      if (_activeConvId === ANNOUNCEMENTS_ID || conv?.type === 'announcement') {
        if (!window.UpperRoom || typeof window.UpperRoom.sendMessage !== 'function') {
          _toast('Announcements channel unavailable', 'error');
          return;
        }
        try {
          await window.UpperRoom.sendMessage(ANNOUNCEMENTS_ID, text);
          input.value = '';
          input.style.height = 'auto';
          _toast('📢 Posted to Church Announcements', 'success');
        } catch (err) {
          console.error('[FlockChat] Failed to post announcement:', err);
          _toast(err?.message || 'Failed to post announcement', 'error');
        }
        return;
      }

      // SMS conversations: hand off to the native SMS composer with the
      // text prefilled, and log the attempt so the thread + recents update.
      if (conv?.type === 'sms') {
        const phone = conv.smsPhone;
        if (!phone) { _toast('No phone on file for this contact', 'error'); return; }
        _launchSms(phone, text);
        await _db.collection('conversations').doc(_activeConvId).collection('messages').add({
          text,
          author: _me.uid,
          authorName: _me.displayName || _me.email,
          type: 'sms',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        await _db.collection('conversations').doc(_activeConvId).update({
          lastMessage: {
            text: '📲 ' + text,
            author: _me.uid,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          },
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Log to the member's touch history so it shows up on their Fold page.
        if (conv.smsMemberUid && window.UpperRoom && typeof window.UpperRoom.createTouch === 'function') {
          try {
            await window.UpperRoom.createTouch({
              memberId:   conv.smsMemberUid,
              memberName: conv.name || '',
              channel:    'text',
              note:       text
            });
          } catch (logErr) {
            console.warn('[FlockChat] Touch log write failed:', logErr);
          }
        }
        _toast('📲 SMS opened — tap Send in your messages app', 'success');
        input.value = '';
        input.style.height = 'auto';
        return;
      }

      const msgType = conv?.type === 'prayer' ? 'prayer' : conv?.type === 'announcement' ? 'announcement' : 'text';

      // Prayer Chain: also create an actual PrayerRequest in the church's
      // prayers collection so it shows up in The Prayer Chain admin view
      // (auto-assigned to the lead pastor by UpperRoom.createPrayer).
      let createdPrayerId = null;
      if (msgType === 'prayer' && window.UpperRoom && typeof window.UpperRoom.createPrayer === 'function') {
        try {
          createdPrayerId = await window.UpperRoom.createPrayer({
            submitterName:  _me.displayName || _me.email || 'Anonymous',
            submitterEmail: _me.email || '',
            prayerText:     text,
            category:       'Other',
            isConfidential: 'FALSE',
            followUpRequested: 'FALSE'
          });
        } catch (err) {
          console.error('[FlockChat] Failed to create PrayerRequest:', err);
          _toast('Posted to chat, but failed to log prayer request', 'error');
        }
      }

      await _db.collection('conversations').doc(_activeConvId).collection('messages').add({
        text,
        author: _me.uid,
        authorName: _me.displayName || _me.email,
        type: msgType,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        prayerCount: msgType === 'prayer' ? 0 : null,
        prayerId: createdPrayerId || null
      });

      if (createdPrayerId) {
        _toast('🙏 Prayer request submitted to the church', 'success');
      }

      // Update conversation lastMessage
      await _db.collection('conversations').doc(_activeConvId).update({
        lastMessage: {
          text,
          author: _me.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Clear input
      input.value = '';
      input.style.height = 'auto';
    } catch (err) {
      console.error('[FlockChat] Failed to send message:', err);
      _toast('Failed to send message', 'error');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /* ── Prayer Action ───────────────────────────────────────────────────── */
  window._prayFor = async function(msgId) {
    if (!_activeConvId) return;
    try {
      const msgRef = _db.collection('conversations').doc(_activeConvId).collection('messages').doc(msgId);
      await msgRef.update({
        prayerCount: firebase.firestore.FieldValue.increment(1)
      });
      _toast('🙏 Added to your prayers', 'success');
    } catch (err) {
      console.error('[FlockChat] Failed to update prayer count:', err);
      _toast('Failed to record prayer', 'error');
    }
  };

  /* ── Utilities ────────────────────────────────────────────────────────── */
  function _formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Today
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // This week
    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    // Older
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function _toast(msg, type = '') {
    const host = $('fc-toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'fc-toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3800);
  }

  /* ══════════════════════════════════════════════════════════════════════
     FlockNews Feed Renderer — Last 7 Days
   ══════════════════════════════════════════════════════════════════════ */

  async function _renderFlockNews(container) {
    container.innerHTML = '<div class="fc-loading"><div class="fc-spinner"></div></div>';
    
    // Calculate last 7 days
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      days.push({ key, date: d });
    }

    // Fetch FlockNews data from Firestore for each day
    const newsCards = [];
    try {
      for (const day of days) {
        const docSnap = await _db.collection('news').doc(day.key).get();
        if (docSnap.exists) {
          const data = docSnap.data();
          newsCards.push({ ...data, dateKey: day.key, date: day.date });
        } else {
          // Add placeholder for missing days
          newsCards.push({ dateKey: day.key, date: day.date, empty: true });
        }
      }
    } catch (err) {
      console.error('[FlockNews] Failed to fetch news data:', err);
    }

    if (newsCards.length === 0 || newsCards.every(n => n.empty)) {
      container.innerHTML = `
        <div class="fc-sct-section">
          <div class="fc-sct-word-empty">
            <div class="fc-sct-word-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e8a838" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <p>No FlockNews content available for the last 7 days.</p>
            <p style="font-size: 14px; color: var(--ink-muted); margin-top: 8px;">
              Check back later for daily spiritual content.
            </p>
          </div>
        </div>`;
      return;
    }

    const cardsHtml = newsCards.map(news => {
      const dateStr = news.date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      if (news.empty) {
        return `
          <div class="fc-flocknews-card fc-flocknews-empty">
            <div class="fc-flocknews-date">${dateStr}</div>
            <p style="color: var(--ink-muted); font-size: 14px; padding: 20px;">No content available for this day.</p>
          </div>`;
      }

      const intro = news.introduction?.content || '';
      const pastor = news.pastorHeart?.content || '';
      const announce = news.announcements?.content || '';
      
      return `
        <div class="fc-flocknews-card">
          <div class="fc-flocknews-header">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8a838" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>FlockNews</span>
          </div>
          <div class="fc-flocknews-date">${dateStr}</div>
          ${intro ? `<div class="fc-flocknews-section">
            <h4>Welcome</h4>
            <div class="fc-flocknews-content">${intro.substring(0, 200)}${intro.length > 200 ? '...' : ''}</div>
          </div>` : ''}
          ${pastor ? `<div class="fc-flocknews-section">
            <h4>Pastor's Heart</h4>
            <div class="fc-flocknews-content">${pastor.substring(0, 200)}${pastor.length > 200 ? '...' : ''}</div>
          </div>` : ''}
          ${announce ? `<div class="fc-flocknews-section">
            <h4>Announcements</h4>
            <div class="fc-flocknews-content">${announce.substring(0, 150)}${announce.length > 150 ? '...' : ''}</div>
          </div>` : ''}
          <a href="../app.flocknews/app.flocknews.html#${news.dateKey}" target="_blank" class="fc-flocknews-link">
            View Full Day ↗
          </a>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="fc-flocknews-feed">
        <div class="fc-flocknews-intro">
          <h3>📰 FlockNews — Last 7 Days</h3>
          <p>Daily spiritual content, Bible readings, devotionals, and church bulletin updates.</p>
        </div>
        ${cardsHtml}
      </div>`;
  }

  console.log('[FlockChat]', VERSION, 'loaded');

})();
