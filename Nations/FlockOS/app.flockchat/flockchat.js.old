/* ══════════════════════════════════════════════════════════════════════════
   FLOCKCHAT.JS — Church Chat Engine (v2)
   "How good and pleasant it is when God's people live together in unity!"
   — Psalm 133:1

   Architecture:
     • Auth: Nehemiah.getSession() — no own auth screen needed
     • Data: Direct Firebase Firestore compat SDK (firebase.firestore())
     • Real-time: Firestore onSnapshot for messages, channels, DMs
     • Typing: Firestore heartbeat (TTL 5s) — no RTDB required
     • Schema: channels/{id}/messages, dms/{id}/messages, prayers, broadcasts, users
       (matches the_word.js schema — data portability across both apps)

   Features (Tinode-inspired, Slack-quality):
     ✦ Channels (public / private / role-gated) + DMs
     ✦ Reply-to-message with quoted context block
     ✦ Emoji reactions (per-message, toggleable)
     ✦ Edit & delete sent messages
     ✦ Rich Markdown: **bold**, _italic_, `code`, ~~strike~~, > quote, ```block```
     ✦ @mention highlights (self gets distinct style)
     ✦ Typing indicator (Firestore heartbeat, 5 s TTL — no RTDB)
     ✦ Presence: lastSeen heartbeat in users/{uid} doc (30 s)
     ✦ Unread badges — localStorage read-cursor per conversation
     ✦ In-thread message search (Ctrl+F) with live result count
     ✦ Quick-switcher (Ctrl+K) — jump to any channel or DM
     ✦ Load-earlier pagination (50-message cursor pages)
     ✦ Pin messages — up to 5 per channel (leaders+)
     ✦ Channel details pane — members list, leave/join
     ✦ Admin panel: manage user roles + channel access control
     ✦ Profile editing — display name, custom status
     ✦ Prayer Chain: submit, browse, mark answered, interactions
     ✦ Announcements: post (leaders+), read-all

   Tabs (sidebar): 💬 Channels | 📨 DMs | 🙏 Prayer | 📢 News
   ══════════════════════════════════════════════════════════════════════════ */

'use strict';

(function() {

  /* ── Constants ─────────────────────────────────────────────────────── */
  const PAGE_SIZE  = 50;
  const TYPING_TTL = 5000; // ms

  const EMOJIS = [
    '👍','❤️','😂','🙏','🔥','✅','🎉','👏',
    '😊','😢','😮','🤔','💪','✨','🙌','💬',
    '📖','⛪','🕊️','🌿','☀️','🌙','⚡','🎶'
  ];

  const SEED_CHANNELS = [
    { name:'general',       description:'General conversation',                      access:'public' },
    { name:'announcements', description:'Important updates from leadership',          access:'public' },
    { name:'prayer-chain',  description:'Share prayer requests and praise reports',   access:'public' }
  ];

  const ALL_ROLES   = ['readonly','volunteer','care','leader','pastor','admin'];
  const ROLE_RANK   = { readonly:0, volunteer:1, care:2, leader:3, pastor:4, admin:5 };
  const ROLE_LABELS = { readonly:'Read Only', volunteer:'Volunteer', care:'Care Team', leader:'Leader', pastor:'Pastor', admin:'Admin' };

  /* ── State ─────────────────────────────────────────────────────────── */
  let _db=null, _me=null;
  let _channels=[], _dms=[], _prayers=[], _announces=[];
  let _activeId=null, _activeType=null;       // type: 'channel'|'dm'
  let _activeTab='channels';                  // 'channels'|'dms'|'prayer'|'announce'
  let _activePrayerId=null, _activeAnnounceId=null;
  let _msgDocs=[], _msgCursor=null, _hasMoreMsgs=false;
  let _msgUnsub=null, _chUnsub=null, _dmUnsub=null;
  let _typingUnsub=null, _prayerUnsub=null, _announceUnsub=null;
  let _userReads={};
  let _isTyping=false, _typingTimer=null;
  let _presenceTimer=null;
  let _replyTarget=null;          // { id, text, authorName }
  let _emojiTarget=null;          // msgId when adding reaction, null = composer insert
  let _detailsOpen=false;
  let _searchActive=false, _searchQuery='';
  let _qsVisible=false;
  let _editMsgId=null;

  /* ── DOM helper ────────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  /* ── HTML escape ────────────────────────────────────────────────────── */
  function _e(s) {
    return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function _initials(name) {
    return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>(w[0]||'').toUpperCase()).join('');
  }

  /* ── Toast ─────────────────────────────────────────────────────────── */
  function _toast(msg,type='') {
    const host=$('fc-toasts'); if(!host) return;
    const el=document.createElement('div');
    el.className='fc-toast'+(type==='error'?' error':type==='success'?' success':'');
    el.textContent=msg; host.appendChild(el);
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('show')));
    setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),300);},3800);
  }

  /* ── Role helpers ──────────────────────────────────────────────────── */
  function _isAdmin() { return _me&&(_me.role==='admin'||_me.role==='pastor'); }
  function _hasRole(min) { return _me&&(ROLE_RANK[_me.role]||0)>=(ROLE_RANK[min]||0); }

  /* ═══════════════════════════════════════════════════════════════════
     BOOT & AUTH
  ═══════════════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded',()=>_boot().catch(err=>{
    _setBootStatus('Error: '+(err?.message||err));
    console.error('[FlockChat]',err);
  }));

  async function _boot() {
    _setBootStatus('Loading…');
    await _waitFor(()=>typeof window.firebase!=='undefined'&&typeof window.Nehemiah!=='undefined');
    const N=window.Nehemiah;
    if(!N.isAuthenticated()){N.guard();return;}
    _me=N.getSession();
    if(!_me){N.guard();return;}
    _setBootStatus('Connecting…');
    try{ _db=firebase.firestore(); }
    catch(err){ _setBootStatus('Failed to connect. Please refresh.'); throw err; }
    _enrichUserDoc().catch(()=>{});
    _initPresence();
    _hideBoot();
    _mountApp();
  }

  function _setBootStatus(msg){const el=$('fc-boot-status');if(el)el.textContent=msg;}
  function _hideBoot(){
    const b=$('fc-boot'); if(!b) return;
    b.classList.add('fade-out');
    setTimeout(()=>{b.style.display='none';},350);
  }

  async function _enrichUserDoc() {
    if(!_db||!_me) return;
    const ref=_db.collection('users').doc(_me.uid);
    const snap=await ref.get();
    if(!snap.exists()){
      await ref.set({displayName:_me.displayName||_me.email,email:_me.email,role:_me.role||'volunteer',status:'online',lastSeen:firebase.firestore.FieldValue.serverTimestamp(),createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    } else {
      const d=snap.data();
      if(d.role&&d.role!==_me.role){_me.role=d.role;}
      if(d.displayName)_me.displayName=d.displayName;
      ref.update({lastSeen:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
    }
  }

  function _mountApp(){
    const app=$('fc-app'); if(app) app.removeAttribute('hidden');
    _showApp(); _bindUI(); _loadUserReads();
    _seedChannels().catch(()=>{});
    _switchTab('channels');
  }

  function _showApp(){
    const uname=$('fc-topbar-uname'); if(uname) uname.textContent=(_me?.displayName||'').split(' ')[0]||'';
    const chip=$('fc-user-chip'); if(chip) chip.textContent=_me?.displayName||_me?.email||'';
    const admin=$('fc-admin-menu-btn'); if(admin) admin.style.display=_isAdmin()?'':'none';
    const newCh=$('fc-new-channel-btn'); if(newCh) newCh.style.display=_hasRole('leader')?'':'none';
    const newAnn=$('fc-new-announce-btn'); if(newAnn) newAnn.style.display=_isAdmin()?'':'none';
  }

  /* ═══════════════════════════════════════════════════════════════════
     PRESENCE (Firestore heartbeat, 30 s)
  ═══════════════════════════════════════════════════════════════════ */
  function _initPresence(){
    if(!_me) return;
    _presenceTimer=setInterval(_pingPresence,30000);
    _pingPresence();
    window.addEventListener('visibilitychange',()=>{if(!document.hidden)_pingPresence();});
  }
  function _pingPresence(){
    if(!_db||!_me) return;
    _db.collection('users').doc(_me.uid).update({lastSeen:firebase.firestore.FieldValue.serverTimestamp(),status:'online'}).catch(()=>{});
  }

  /* ═══════════════════════════════════════════════════════════════════
     READ TRACKING & UNREAD BADGES
  ═══════════════════════════════════════════════════════════════════ */
  function _loadUserReads(){
    if(!_me) return;
    try{_userReads=JSON.parse(localStorage.getItem('fc_reads_'+_me.uid)||'{}');}catch(_){}
  }
  function _markRead(id){
    if(!_me) return;
    _userReads[id]=Date.now();
    try{localStorage.setItem('fc_reads_'+_me.uid,JSON.stringify(_userReads));}catch(_){}
    const badge=$('badge-'+id); if(badge) badge.textContent='';
  }

  /* ═══════════════════════════════════════════════════════════════════
     SEED DEFAULT CHANNELS
  ═══════════════════════════════════════════════════════════════════ */
  async function _seedChannels(){
    const snap=await _db.collection('channels').limit(1).get();
    if(!snap.empty) return;
    for(const ch of SEED_CHANNELS){
      await _db.collection('channels').add({name:ch.name,description:ch.description,access:ch.access,createdBy:_me.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp(),members:[_me.uid],messageCount:0,pins:[]});
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     TAB SWITCHING
  ═══════════════════════════════════════════════════════════════════ */
  function _switchTab(tab){
    _activeTab=tab;
    ['channels','dms','prayer','announce'].forEach(t=>{
      const el=$('fc-pane-'+t); if(el) el.style.display=(t===tab)?'':'none';
    });
    $$('.fc-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===tab));
    if(tab==='channels'&&!_chUnsub)    _startChannelListener();
    if(tab==='dms'     &&!_dmUnsub)    _startDMListener();
    if(tab==='prayer'  &&!_prayerUnsub) _startPrayerListener();
    if(tab==='announce'&&!_announceUnsub)_startAnnounceListener();
    if(tab!=='channels'&&tab!=='dms'){
      if(tab==='prayer'  &&!_activePrayerId)    _showWelcome();
      if(tab==='announce'&&!_activeAnnounceId)  _showWelcome();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHANNEL LISTENER
  ═══════════════════════════════════════════════════════════════════ */
  function _startChannelListener(){
    if(_chUnsub) return;
    _chUnsub=_db.collection('channels').onSnapshot(snap=>{
      _channels=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
      _renderChannelList();
    },err=>console.error('[FC] channels:',err));
  }

  function _renderChannelList(){
    const container=$('fc-channel-list'); if(!container) return;
    const search=($('fc-sidebar-search')?.value||'').toLowerCase();
    const visible=_channels.filter(ch=>{
      if(ch.access==='private'&&!(ch.members||[]).includes(_me?.uid)&&!_isAdmin()) return false;
      if(ch.access==='role-gated'&&ch.minRole&&!_hasRole(ch.minRole)&&!_isAdmin()) return false;
      return !search||ch.name.toLowerCase().includes(search);
    });
    if(!visible.length){container.innerHTML='<div class="fc-empty-small">No channels</div>';return;}
    container.innerHTML=visible.map(ch=>{
      const lastRead=_userReads[ch.id]||0;
      const lastTs=ch.lastTimestamp?.toMillis?.()||0;
      const unread=lastTs>lastRead&&ch.id!==_activeId;
      const icon=ch.access==='private'?'🔒':_channelEmoji(ch.name);
      return `<div class="fc-convo-item${_activeId===ch.id?' active':''}${unread?' has-unread':''}" data-id="${_e(ch.id)}" data-type="channel" tabindex="0" role="button">
        <div class="fc-convo-icon channel">${icon}</div>
        <div class="fc-convo-info">
          <div class="fc-convo-name">${_e(ch.name)}</div>
          ${ch.description?`<div class="fc-convo-snippet">${_e(ch.description)}</div>`:''}
        </div>
        <span class="fc-unread-dot" id="badge-${_e(ch.id)}">${unread?'●':''}</span>
      </div>`;
    }).join('');
    container.querySelectorAll('.fc-convo-item').forEach(el=>{
      el.addEventListener('click',()=>_openChannel(_channels.find(c=>c.id===el.dataset.id)));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')_openChannel(_channels.find(c=>c.id===el.dataset.id));});
    });
  }

  function _channelEmoji(name){
    const n=(name||'').toLowerCase();
    if(n.includes('general'))      return '💬';
    if(n.includes('announcement')) return '📢';
    if(n.includes('prayer'))       return '🙏';
    if(n.includes('worship'))      return '🎵';
    if(n.includes('leadership'))   return '👑';
    if(n.includes('kids'))         return '🧒';
    if(n.includes('youth'))        return '✨';
    return '#';
  }

  /* ═══════════════════════════════════════════════════════════════════
     DM LISTENER
  ═══════════════════════════════════════════════════════════════════ */
  function _startDMListener(){
    if(_dmUnsub||!_me) return;
    const q=_db.collection('dms').where('members','array-contains',_me.uid);
    _dmUnsub=q.onSnapshot(async snap=>{
      _dms=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.lastTimestamp?.toMillis?.()||0)-(a.lastTimestamp?.toMillis?.()||0));
      await _renderDMList();
    },err=>console.error('[FC] dms:',err));
  }

  async function _renderDMList(){
    const container=$('fc-dm-list'); if(!container) return;
    const search=($('fc-sidebar-search')?.value||'').toLowerCase();
    if(!_dms.length){container.innerHTML='<div class="fc-empty-small">No DMs yet</div>';return;}
    const rows=await Promise.all(_dms.map(async dm=>{
      const otherId=(dm.members||[]).find(id=>id!==_me.uid);
      if(!otherId) return '';
      let otherName=dm.otherName||otherId;
      try{const u=await _db.collection('users').doc(otherId).get();if(u.exists())otherName=u.data().displayName||otherName;}catch(_){}
      if(search&&!otherName.toLowerCase().includes(search)) return '';
      const lastRead=_userReads[dm.id]||0;
      const lastTs=dm.lastTimestamp?.toMillis?.()||0;
      const unread=lastTs>lastRead&&dm.id!==_activeId;
      return `<div class="fc-convo-item${_activeId===dm.id?' active':''}${unread?' has-unread':''}" data-id="${_e(dm.id)}" data-type="dm" data-name="${_e(otherName)}" tabindex="0" role="button">
        <div class="fc-convo-icon">${_initials(otherName)}</div>
        <div class="fc-convo-info">
          <div class="fc-convo-name">${_e(otherName)}</div>
          ${dm.lastMessage?`<div class="fc-convo-snippet">${_e(dm.lastMessage)}</div>`:''}
        </div>
        <span class="fc-unread-dot" id="badge-${_e(dm.id)}">${unread?'●':''}</span>
      </div>`;
    }));
    container.innerHTML=rows.join('');
    container.querySelectorAll('.fc-convo-item').forEach(el=>{
      el.addEventListener('click',()=>_openDM(_dms.find(d=>d.id===el.dataset.id),el.dataset.name));
      el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')_openDM(_dms.find(d=>d.id===el.dataset.id),el.dataset.name);});
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     OPEN CHANNEL / DM
  ═══════════════════════════════════════════════════════════════════ */
  function _openChannel(ch){
    if(!ch) return;
    const isMember=(ch.members||[]).includes(_me?.uid);
    _setActive(ch.id,'channel');
    _setTopbar((ch.access==='private'?'🔒 ':'')+ch.name,ch.description||'');
    _updatePlaceholder('Message #'+ch.name+'…');
    _renderDetails(ch);
    const joinBanner=$('fc-join-banner'), composer=$('fc-composer');
    if(isMember){
      if(joinBanner) joinBanner.style.display='none';
      if(composer) composer.style.display='';
    } else if(ch.access==='role-gated'&&ch.minRole&&!_hasRole(ch.minRole)){
      _showJoinBanner('This channel requires '+( ROLE_LABELS[ch.minRole]||ch.minRole)+' access.',false);
    } else if(ch.access==='private'){
      _showJoinBanner('This is a private channel. Contact an admin to be invited.',false);
    } else {
      _showJoinBanner("You're not in this channel yet.",true,()=>_joinChannel(ch));
    }
    _markRead(ch.id);
    _listenMessages('channels',ch.id);
    _renderChannelList();
    if(window.innerWidth<=640) _closeSidebar();
  }

  function _openDM(dm,otherName){
    if(!dm) return;
    _setActive(dm.id,'dm');
    _setTopbar(otherName||dm.id,'Direct Message');
    _updatePlaceholder('Message '+( otherName||'')+'…');
    if($('fc-join-banner')) $('fc-join-banner').style.display='none';
    if($('fc-composer'))    $('fc-composer').style.display='';
    _markRead(dm.id);
    _listenMessages('dms',dm.id);
    _renderDMList();
    if(window.innerWidth<=640) _closeSidebar();
  }

  function _setActive(id,type){
    _activeId=id; _activeType=type;
    _activePrayerId=null; _activeAnnounceId=null;
    _clearReplyTarget();
    if(_msgUnsub){_msgUnsub();_msgUnsub=null;}
    if(_typingUnsub){_typingUnsub();_typingUnsub=null;}
    const ml=$('fc-msg-list'); if(ml) ml.innerHTML='<div class="fc-spinner"><div class="fc-spin"></div></div>';
    _showPanel('fc-thread');
    const sbtn=$('fc-search-btn'); if(sbtn) sbtn.style.display='';
    $$('.fc-convo-item').forEach(el=>el.classList.toggle('active',el.dataset.id===id));
  }

  function _setTopbar(name,desc){
    const r=$('fc-topbar-room');if(r)r.textContent=name;
    const d=$('fc-topbar-desc');if(d)d.textContent=desc;
  }
  function _updatePlaceholder(ph){const inp=$('fc-composer-input');if(inp)inp.placeholder=ph;}

  function _showJoinBanner(text,showBtn,cb){
    const banner=$('fc-join-banner'); if(!banner) return;
    const msgEl=banner.querySelector('.fc-join-text');
    const joinBtn=$('fc-join-btn');
    if(msgEl) msgEl.textContent=text;
    if(joinBtn){joinBtn.style.display=showBtn?'':'none';joinBtn.onclick=cb||null;}
    banner.style.display='flex';
    if($('fc-composer')) $('fc-composer').style.display='none';
  }

  /* ═══════════════════════════════════════════════════════════════════
     MESSAGE LISTENER
  ═══════════════════════════════════════════════════════════════════ */
  function _listenMessages(colName,parentId){
    _msgDocs=[]; _msgCursor=null; _hasMoreMsgs=false;
    const msgCol=_db.collection(colName).doc(parentId).collection('messages');
    const q=msgCol.orderBy('timestamp','desc').limit(PAGE_SIZE);
    _msgUnsub=q.onSnapshot(snap=>{
      if(!snap.empty){_msgCursor=snap.docs[snap.docs.length-1];_hasMoreMsgs=snap.docs.length>=PAGE_SIZE;}
      const recent=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      const recentIds=new Set(recent.map(m=>m.id));
      const older=_msgDocs.filter(m=>!recentIds.has(m.id));
      _msgDocs=[...older,...recent];
      _renderMessages(_msgDocs);
    },err=>console.error('[FC] messages:',err));
    // Typing indicator
    _typingUnsub=_db.collection('typing_indicators').doc(parentId).onSnapshot(snap=>{
      const data=snap.data()||{};
      const now=Date.now();
      const typers=Object.entries(data).filter(([uid,ts])=>uid!==_me?.uid&&ts?.toMillis?.()&&now-ts.toMillis()<TYPING_TTL).map(([uid])=>uid);
      _renderTyping(typers);
    },()=>{});
  }

  async function _loadEarlierMessages(){
    if(!_msgCursor||!_activeId||!_activeType) return;
    const colName=_activeType==='channel'?'channels':'dms';
    const msgCol=_db.collection(colName).doc(_activeId).collection('messages');
    const snap=await msgCol.orderBy('timestamp','desc').limit(PAGE_SIZE).startAfter(_msgCursor).get();
    if(!snap.empty){
      _msgCursor=snap.docs[snap.docs.length-1];
      _hasMoreMsgs=snap.docs.length>=PAGE_SIZE;
      const older=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      const existIds=new Set(_msgDocs.map(m=>m.id));
      _msgDocs=[...older.filter(m=>!existIds.has(m.id)),..._msgDocs];
    } else { _hasMoreMsgs=false; }
    _renderMessages(_msgDocs,true);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER MESSAGES
  ═══════════════════════════════════════════════════════════════════ */
  function _renderMessages(msgs,preserveScroll){
    const list=$('fc-msg-list'); if(!list) return;
    const wasAtBottom=list.scrollHeight-list.scrollTop-list.clientHeight<80;
    const prevH=list.scrollHeight;
    list.innerHTML='';

    if(_hasMoreMsgs){
      const btn=document.createElement('button');
      btn.className='fc-load-more-btn';
      btn.textContent='↑ Load earlier messages';
      btn.onclick=_loadEarlierMessages;
      list.appendChild(btn);
    }

    const ch=_activeType==='channel'?_channels.find(c=>c.id===_activeId):null;
    const pins=ch?.pins||[];

    if(!msgs.length){
      list.innerHTML+='<div class="fc-empty fc-thread-empty"><div class="fc-empty-icon">✉️</div><p>No messages yet — say something!</p></div>';
      _renderPinStrip(pins); return;
    }

    let lastDate='',lastAuthor='',lastTs=null;
    msgs.forEach(msg=>{
      const ts=msg.timestamp?.toDate?.()||new Date();
      const dateStr=ts.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
      const grouped=lastAuthor===msg.authorId&&lastTs&&(ts-lastTs<5*60*1000);
      const matches=!_searchActive||!_searchQuery||(msg.text||'').toLowerCase().includes(_searchQuery.toLowerCase())||(msg.authorName||'').toLowerCase().includes(_searchQuery.toLowerCase());

      if(dateStr!==lastDate){
        const d=document.createElement('div');
        d.className='fc-day-sep';
        d.innerHTML=`<div class="fc-day-line"></div><span>${_e(dateStr)}</span><div class="fc-day-line"></div>`;
        list.appendChild(d);
        lastDate=dateStr;
      }

      const row=document.createElement('div');
      row.className='fc-msg-row'+(grouped?' grouped':'')+(matches?'':' fc-search-hidden');
      row.dataset.msgId=msg.id;

      const timeStr=ts.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      const reactions=_renderReactionChips(msg.reactions||{});
      const canEdit=msg.authorId===_me?.uid&&!msg.deletedAt;
      const canPin=_hasRole('leader');
      const isPinned=pins.some(p=>p.id===msg.id);
      const bodyHtml=msg.deletedAt?'<em class="fc-msg-deleted">This message was deleted.</em>':_formatText(msg.text||'');
      const replyHtml=msg.replyTo?`<div class="fc-msg-reply-quote" data-jump="${_e(msg.replyTo.id)}"><span class="fc-msg-reply-author">${_e(msg.replyTo.authorName||'Unknown')}</span> <span class="fc-msg-reply-text">${_e((msg.replyTo.text||'').substring(0,80))}${(msg.replyTo.text||'').length>80?'…':''}</span></div>`:'';

      row.innerHTML=`
        <div class="fc-msg-avatar${grouped?' hidden':''}">${_e(_initials(msg.authorName||'?'))}</div>
        <div class="fc-msg-body">
          <div class="fc-msg-meta${grouped?' hidden':''}">
            <span class="fc-msg-author">${_e(msg.authorName||'Unknown')}</span>
            <span class="fc-msg-time">${timeStr}</span>
          </div>
          ${replyHtml}
          <div class="fc-msg-text">${bodyHtml}${msg.editedAt?'<span class="fc-msg-edited"> (edited)</span>':''}</div>
          ${reactions}
        </div>
        ${!msg.deletedAt?`<div class="fc-msg-actions">
          <button class="fc-msg-btn" title="Reply"  data-action="reply"  data-id="${msg.id}" data-author="${_e(msg.authorName||'')}" data-text="${_e((msg.text||'').substring(0,100))}">↩</button>
          <button class="fc-msg-btn" title="React"  data-action="react"  data-id="${msg.id}">😊</button>
          ${canPin?`<button class="fc-msg-btn" title="${isPinned?'Unpin':'Pin'}" data-action="pin" data-id="${msg.id}" data-text="${_e((msg.text||'').substring(0,100))}">${isPinned?'📌':'📎'}</button>`:''}
          ${canEdit?`<button class="fc-msg-btn" title="Edit" data-action="edit" data-id="${msg.id}">✏️</button>`:''}
          ${canEdit?`<button class="fc-msg-btn" title="Delete" data-action="delete" data-id="${msg.id}">🗑️</button>`:''}
        </div>`:''}`;

      // Jump to quoted message
      row.querySelectorAll('.fc-msg-reply-quote').forEach(el=>{
        el.addEventListener('click',()=>{
          const target=list.querySelector(`[data-msg-id="${el.dataset.jump}"]`);
          if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('fc-msg-highlight');setTimeout(()=>target.classList.remove('fc-msg-highlight'),1800);}
        });
      });

      // Reaction chip clicks
      row.querySelectorAll('.fc-reaction-chip').forEach(chip=>{
        chip.addEventListener('click',()=>_toggleReaction(msg.id,chip.dataset.emoji));
      });

      // Action button clicks
      row.querySelectorAll('.fc-msg-btn').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          const{action,id,author,text}=btn.dataset;
          if(action==='reply')  _setReplyTarget({id,authorName:author,text:msg.text||''});
          if(action==='react')  _showEmojiPicker(e,id);
          if(action==='pin')    _togglePinMessage(id,text);
          if(action==='edit')   _startEditMessage(msg);
          if(action==='delete') _deleteMessage(msg.id);
        });
      });

      list.appendChild(row);
      lastAuthor=msg.authorId; lastTs=ts;
    });

    if(preserveScroll) list.scrollTop=list.scrollHeight-prevH+list.scrollTop;
    else if(wasAtBottom||msgs.length<=3) list.scrollTop=list.scrollHeight;
    _renderPinStrip(pins);
    _updateSearchCount();
  }

  function _renderReactionChips(reactions){
    const entries=Object.entries(reactions);
    if(!entries.length) return '';
    const chips=entries.map(([emoji,uids])=>{
      const reacted=uids.includes(_me?.uid);
      return `<div class="fc-reaction-chip${reacted?' reacted':''}" data-emoji="${_e(emoji)}"><span>${emoji}</span><span class="fc-reaction-count">${uids.length}</span></div>`;
    }).join('');
    return `<div class="fc-msg-reactions">${chips}</div>`;
  }

  function _formatText(text){
    let t=_e(text);
    t=t.replace(/```([\s\S]*?)```/g,(_,code)=>`<pre class="fc-code-block"><code>${code.trim()}</code></pre>`);
    t=t.replace(/`([^\`\n]+)`/g,'<code class="fc-inline-code">$1</code>');
    t=t.replace(/\*\*(.+?)\*\*/gs,'<strong>$1</strong>');
    t=t.replace(/\*([^\*\n]+)\*/g,'<em>$1</em>');
    t=t.replace(/_([^\_ \n][^_\n]*)_/g,'<em>$1</em>');
    t=t.replace(/~~(.+?)~~/g,'<del>$1</del>');
    t=t.replace(/(^|\n)&gt; (.+)/g,'$1<blockquote class="fc-blockquote">$2</blockquote>');
    t=t.replace(/(https?:\/\/[^\s<>"&]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer" class="fc-msg-link">$1</a>');
    t=t.replace(/@(channel|here)/gi,'<span class="fc-mention fc-mention-channel">@$1</span>');
    t=t.replace(/@(\w[\w.]*)/g,(_,name)=>{
      const isSelf=name.toLowerCase()===(_me?.displayName||'').toLowerCase();
      return `<span class="fc-mention${isSelf?' fc-mention-self':''}">@${name}</span>`;
    });
    t=t.replace(/\n/g,'<br>');
    return t;
  }

  /* ═══════════════════════════════════════════════════════════════════
     REPLY TO MESSAGE
  ═══════════════════════════════════════════════════════════════════ */
  function _setReplyTarget(target){
    _replyTarget=target;
    const bar=$('fc-reply-bar'); if(!bar) return;
    bar.style.display='flex';
    const name=bar.querySelector('.fc-reply-author');
    const text=bar.querySelector('.fc-reply-text');
    if(name) name.textContent=target.authorName||'Unknown';
    if(text) text.textContent=(target.text||'').substring(0,80)+((target.text||'').length>80?'…':'');
    $('fc-composer-input')?.focus();
  }
  function _clearReplyTarget(){
    _replyTarget=null;
    const bar=$('fc-reply-bar'); if(bar) bar.style.display='none';
  }

  /* ═══════════════════════════════════════════════════════════════════
     SEND / EDIT / DELETE
  ═══════════════════════════════════════════════════════════════════ */
  async function _sendMessage(){
    const input=$('fc-composer-input'); if(!input) return;
    const text=input.value.trim(); if(!text||!_activeId||!_me) return;
    const colName=_activeType==='channel'?'channels':'dms';
    input.value=''; input.style.height='auto';
    const sendBtn=$('fc-send-btn'); if(sendBtn) sendBtn.disabled=true;
    _stopTyping();
    const payload={authorId:_me.uid,authorName:_me.displayName||_me.email,text,reactions:{},editedAt:null,deletedAt:null,timestamp:firebase.firestore.FieldValue.serverTimestamp()};
    if(_replyTarget) payload.replyTo={id:_replyTarget.id,authorName:_replyTarget.authorName,text:(_replyTarget.text||'').substring(0,200)};
    _clearReplyTarget();
    try{
      await _db.collection(colName).doc(_activeId).collection('messages').add(payload);
      await _db.collection(colName).doc(_activeId).update({lastMessage:text.substring(0,100),lastTimestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});
    }catch(err){_toast('Failed to send message','error');input.value=text;console.error(err);}
    if(sendBtn) sendBtn.disabled=false;
  }

  function _startEditMessage(msg){
    _editMsgId=msg.id;
    const row=document.querySelector(`[data-msg-id="${msg.id}"]`); if(!row) return;
    const textEl=row.querySelector('.fc-msg-text');
    const orig=msg.text;
    textEl.innerHTML=`<textarea class="fc-edit-ta" rows="2">${_e(orig)}</textarea><div class="fc-edit-actions"><button class="fc-edit-save">Save</button><button class="fc-edit-cancel">Cancel</button></div>`;
    const ta=textEl.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
    textEl.querySelector('.fc-edit-save').onclick=async()=>{
      const newText=ta.value.trim(); if(!newText) return;
      const colName=_activeType==='channel'?'channels':'dms';
      await _db.collection(colName).doc(_activeId).collection('messages').doc(msg.id).update({text:newText,editedAt:firebase.firestore.FieldValue.serverTimestamp()});
      _editMsgId=null;
    };
    textEl.querySelector('.fc-edit-cancel').onclick=()=>{textEl.innerHTML=_formatText(orig);_editMsgId=null;};
  }

  async function _deleteMessage(msgId){
    _openConfirmModal('Delete Message', 'This message will be permanently deleted.', 'Delete', async () => {
      const colName=_activeType==='channel'?'channels':'dms';
      await _db.collection(colName).doc(_activeId).collection('messages').doc(msgId).update({deletedAt:firebase.firestore.FieldValue.serverTimestamp(),text:''});
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     REACTIONS
  ═══════════════════════════════════════════════════════════════════ */
  async function _toggleReaction(msgId,emoji){
    if(!_me||!_activeId) return;
    const colName=_activeType==='channel'?'channels':'dms';
    const msgRef=_db.collection(colName).doc(_activeId).collection('messages').doc(msgId);
    const snap=await msgRef.get(); if(!snap.exists()) return;
    const reactions={...(snap.data().reactions||{})};
    const uids=reactions[emoji]||[];
    const has=uids.includes(_me.uid);
    if(has){reactions[emoji]=uids.filter(u=>u!==_me.uid);if(!reactions[emoji].length)delete reactions[emoji];}
    else{reactions[emoji]=[...uids,_me.uid];}
    await msgRef.update({reactions});
  }

  /* ═══════════════════════════════════════════════════════════════════
     EMOJI PICKER
  ═══════════════════════════════════════════════════════════════════ */
  function _buildEmojiPicker(){
    const grid=$('fc-emoji-grid'); if(!grid) return;
    EMOJIS.forEach(emoji=>{
      const btn=document.createElement('button');
      btn.className='fc-emoji-btn'; btn.textContent=emoji;
      btn.onclick=()=>{
        if(_emojiTarget){_toggleReaction(_emojiTarget,emoji);}
        else{const inp=$('fc-composer-input');if(inp){inp.value+=emoji;inp.dispatchEvent(new Event('input'));inp.focus();}}
        _closeEmojiPicker();
      };
      grid.appendChild(btn);
    });
    document.addEventListener('click',e=>{
      const picker=$('fc-emoji-picker');
      if(picker&&!picker.contains(e.target)&&!e.target.closest('[data-action="react"]')&&e.target.id!=='fc-emoji-btn') _closeEmojiPicker();
    });
  }

  function _showEmojiPicker(e,msgId){
    e.stopPropagation(); _emojiTarget=msgId||null;
    const picker=$('fc-emoji-picker'); if(!picker) return;
    picker.style.display='block';
    const rect=e.currentTarget.getBoundingClientRect();
    const l=Math.min(rect.left,window.innerWidth-280);
    picker.style.left=Math.max(4,l)+'px';
    const spaceBelow=window.innerHeight-rect.bottom;
    const ph=picker.offsetHeight||240;
    if(spaceBelow>=ph+10){picker.style.top=(rect.bottom+6)+'px';picker.style.bottom='auto';}
    else{picker.style.bottom=(window.innerHeight-rect.top+6)+'px';picker.style.top='auto';}
  }
  function _closeEmojiPicker(){const p=$('fc-emoji-picker');if(p)p.style.display='none';_emojiTarget=null;}

  /* ═══════════════════════════════════════════════════════════════════
     TYPING INDICATOR (Firestore heartbeat, 5 s TTL)
  ═══════════════════════════════════════════════════════════════════ */
  function _startTyping(){
    if(!_isTyping&&_activeId&&_me){
      _isTyping=true;
      _db.collection('typing_indicators').doc(_activeId).set({[_me.uid]:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}).catch(()=>{});
    }
    clearTimeout(_typingTimer);
    _typingTimer=setTimeout(_stopTyping,3000);
  }
  function _stopTyping(){
    clearTimeout(_typingTimer);
    if(_isTyping&&_activeId&&_me){
      _isTyping=false;
      _db.collection('typing_indicators').doc(_activeId).update({[_me.uid]:firebase.firestore.FieldValue.delete()}).catch(()=>{});
    }
  }
  function _renderTyping(uids){
    const el=$('fc-typing-indicator'); if(!el) return;
    if(!uids.length){el.innerHTML='';return;}
    el.innerHTML=`<div class="fc-typing-dots"><span></span><span></span><span></span></div><span>${uids.length===1?'Someone is':uids.length+' people are'} typing…</span>`;
  }

  /* ═══════════════════════════════════════════════════════════════════
     PIN MESSAGES
  ═══════════════════════════════════════════════════════════════════ */
  async function _togglePinMessage(msgId,text){
    if(!_activeId||_activeType!=='channel') return;
    const ch=_channels.find(c=>c.id===_activeId); if(!ch) return;
    const pins=ch.pins||[]; const idx=pins.findIndex(p=>p.id===msgId);
    let newPins;
    if(idx>=0){newPins=pins.filter(p=>p.id!==msgId);}
    else{if(pins.length>=5){_toast('Max 5 pinned messages per channel.','error');return;}newPins=[...pins,{id:msgId,text}];}
    await _db.collection('channels').doc(_activeId).update({pins:newPins});
  }

  function _renderPinStrip(pins){
    const strip=$('fc-pin-strip'); if(!strip) return;
    if(!pins?.length){strip.style.display='none';return;}
    strip.style.display='flex';
    const text=$('fc-pin-text'); if(text) text.textContent=pins[pins.length-1]?.text?.substring(0,60)||'';
    const count=$('fc-pin-count'); if(count) count.textContent=pins.length>1?pins.length+' pinned':'';
  }

  /* ═══════════════════════════════════════════════════════════════════
     MESSAGE SEARCH
  ═══════════════════════════════════════════════════════════════════ */
  function _toggleSearch(){
    _searchActive=!_searchActive;
    const bar=$('fc-search-bar'); if(bar) bar.style.display=_searchActive?'flex':'none';
    if(_searchActive) $('fc-search-input')?.focus();
    else{_searchQuery='';_renderMessages(_msgDocs);}
  }
  function _closeSearch(){_searchActive=false;_searchQuery='';const bar=$('fc-search-bar');if(bar)bar.style.display='none';_renderMessages(_msgDocs);}
  function _updateSearchCount(){
    const countEl=$('fc-search-count'); if(!_searchActive||!countEl) return;
    const visible=$$('#fc-msg-list .fc-msg-row:not(.fc-search-hidden)').length;
    countEl.textContent=_searchQuery?visible+' result'+(visible!==1?'s':''):'';
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHANNEL JOIN / LEAVE
  ═══════════════════════════════════════════════════════════════════ */
  async function _joinChannel(ch){
    await _db.collection('channels').doc(ch.id).update({members:firebase.firestore.FieldValue.arrayUnion(_me.uid)});
    _openChannel({...ch,members:[...(ch.members||[]),_me.uid]});
    _toast('Joined #'+ch.name+'!','success');
  }
  async function _leaveChannel(chId,chName){
    _openConfirmModal('Leave Channel', `Leave #${_e(chName)}? You can rejoin at any time.`, 'Leave', async () => {
      await _db.collection('channels').doc(chId).update({members:firebase.firestore.FieldValue.arrayRemove(_me.uid)});
      _activeId=null; _activeType=null;
      _showWelcome(); _renderChannelList();
      _toast('Left #'+chName);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     QUICK SWITCHER (Ctrl+K)
  ═══════════════════════════════════════════════════════════════════ */
  function _openQuickSwitcher(){
    _qsVisible=true;
    const qs=$('fc-quick-switcher'); if(qs) qs.removeAttribute('hidden');
    $('fc-qs-input')?.focus();
    _renderQSList('');
  }
  function _closeQuickSwitcher(){
    _qsVisible=false;
    const qs=$('fc-quick-switcher'); if(qs) qs.setAttribute('hidden','');
    const inp=$('fc-qs-input'); if(inp) inp.value='';
  }
  function _renderQSList(query){
    const list=$('fc-qs-list'); if(!list) return;
    const q=query.toLowerCase();
    const results=[
      ..._channels.filter(c=>!q||c.name.toLowerCase().includes(q)).map(c=>({type:'channel',id:c.id,name:c.name})),
      ..._dms.map(d=>{const n=d.otherName||d.id;return(!q||n.toLowerCase().includes(q))?{type:'dm',id:d.id,name:n}:null;}).filter(Boolean)
    ].slice(0,10);
    list.innerHTML=results.map((r,i)=>`<div class="fc-qs-item${i===0?' selected':''}" data-type="${r.type}" data-id="${_e(r.id)}" data-name="${_e(r.name)}" tabindex="0" role="button">${r.type==='channel'?'#':'💬'} ${_e(r.name)}</div>`).join('')||'<div class="fc-qs-empty">No results</div>';
    list.querySelectorAll('.fc-qs-item').forEach(el=>{
      el.addEventListener('click',()=>{
        if(el.dataset.type==='channel'){const ch=_channels.find(c=>c.id===el.dataset.id);if(ch){_switchTab('channels');_openChannel(ch);}}
        else{const dm=_dms.find(d=>d.id===el.dataset.id);if(dm){_switchTab('dms');_openDM(dm,el.dataset.name);}}
        _closeQuickSwitcher();
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     CHANNEL DETAILS PANE
  ═══════════════════════════════════════════════════════════════════ */
  async function _renderDetails(ch){
    const membersEl=$('fc-details-members'); if(!membersEl) return;
    if($('fc-details-title')) $('fc-details-title').textContent='# '+ch.name;
    if($('fc-details-desc'))  $('fc-details-desc').textContent=ch.description||'No description.';
    const leaveSection=$('fc-details-leave-section');
    const isMember=(ch.members||[]).includes(_me?.uid);
    if(leaveSection) leaveSection.style.display=isMember?'':'none';
    const leaveBtn=$('fc-details-leave-btn');
    if(leaveBtn) leaveBtn.onclick=()=>_leaveChannel(ch.id,ch.name);
    membersEl.innerHTML='<div class="fc-spinner"><div class="fc-spin"></div></div>';
    try{
      const rows=await Promise.all((ch.members||[]).map(async uid=>{
        const snap=await _db.collection('users').doc(uid).get();
        const d=snap.exists()?snap.data():{};
        return `<div class="fc-member-row"><div class="fc-member-avatar">${_initials(d.displayName||uid)}</div><span class="fc-member-name">${_e(d.displayName||uid)}</span><span class="fc-member-role">${_e(d.role||'volunteer')}</span></div>`;
      }));
      membersEl.innerHTML=rows.join('');
    }catch(_){membersEl.innerHTML='<div style="font-size:0.8rem;opacity:0.5">Could not load members.</div>';}
  }

  /* ═══════════════════════════════════════════════════════════════════
     PRAYER CHAIN
  ═══════════════════════════════════════════════════════════════════ */
  function _startPrayerListener(){
    if(_prayerUnsub) return;
    _prayerUnsub=_db.collection('prayers').orderBy('submittedAt','desc').limit(50).onSnapshot(snap=>{
      _prayers=snap.docs.map(d=>({id:d.id,...d.data()}));
      _renderPrayerList();
    },()=>{});
  }

  function _renderPrayerList(){
    const el=$('fc-prayer-list'); if(!el) return;
    if(!_prayers.length){el.innerHTML='<div class="fc-empty"><div class="fc-empty-icon">🙏</div><p>No prayer requests yet.<br>Be the first to share one!</p></div>';return;}
    el.innerHTML=_prayers.map(p=>{
      const status=(p.status||'New').toLowerCase();
      return `<div class="fc-prayer-item${_activePrayerId===p.id?' active':''}" data-id="${_e(p.id)}" tabindex="0" role="button">
        <div class="fc-prayer-name">${_e(p.submitterName||'Anonymous')}</div>
        <div class="fc-prayer-preview">${_e(p.prayerText||'')}</div>
        <span class="fc-prayer-status ${status}">${_e(p.status||'New')}</span>
      </div>`;
    }).join('');
    el.querySelectorAll('.fc-prayer-item').forEach(item=>{
      item.addEventListener('click',()=>_openPrayer(item.dataset.id));
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')_openPrayer(item.dataset.id);});
    });
  }

  async function _openPrayer(prayerId){
    _activePrayerId=prayerId; _activeAnnounceId=null; _activeId=null;
    $$('.fc-prayer-item').forEach(el=>el.classList.toggle('active',el.dataset.id===prayerId));
    const prayer=_prayers.find(p=>p.id===prayerId); if(!prayer) return;
    _showPanel('fc-prayer-panel');
    const tname=$('fc-topbar-room');if(tname)tname.textContent=prayer.submitterName||'Prayer Request';
    const tdesc=$('fc-topbar-desc');if(tdesc)tdesc.textContent=prayer.category||'';
    const markBtn=$('fc-mark-answered-btn');if(markBtn)markBtn.style.display=_isAdmin()?'':'none';
    const detail=$('fc-prayer-detail'); if(!detail) return;
    const ts=prayer.submittedAt?.toDate?.()||new Date();
    const tsStr=ts.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    detail.innerHTML=`
      ${prayer.category?`<div class="fc-prayer-category-label">${_e(prayer.category)}</div>`:''}
      <h2 class="fc-prayer-title">Prayer for ${_e(prayer.submitterName||'Anonymous')}</h2>
      <div class="fc-prayer-body">${_e(prayer.prayerText||'')}</div>
      <div class="fc-prayer-meta">${tsStr?`<span>Submitted ${_e(tsStr)}</span>`:''}
        <span class="fc-prayer-status ${(prayer.status||'New').toLowerCase()}">${_e(prayer.status||'New')}</span>
        ${prayer.isConfidential==='TRUE'?'<span class="fc-prayer-conf">Confidential</span>':''}
      </div>
      <div class="fc-interactions-header">Responses &amp; Updates</div>
      <div id="fc-interactions-list"><div class="fc-spinner"><div class="fc-spin"></div></div></div>`;
    _db.collection('prayers').doc(prayerId).collection('interactions').orderBy('createdAt','asc').limit(20).get().then(snap=>{
      const iEl=$('fc-interactions-list'); if(!iEl) return;
      if(snap.empty){iEl.innerHTML='<div class="fc-empty-small">No responses yet.</div>';return;}
      iEl.innerHTML=snap.docs.map(d=>{const ia=d.data();return `<div class="fc-interaction-item"><div class="fc-interaction-text">${_e(ia.note||ia.text||'')}</div><div class="fc-interaction-meta">${_e(ia.createdBy||'')}</div></div>`;}).join('');
    }).catch(()=>{});
    if(window.innerWidth<=640) _closeSidebar();
  }

  async function _markPrayerAnswered(){
    if(!_activePrayerId) return;
    await _db.collection('prayers').doc(_activePrayerId).update({status:'answered',answeredAt:firebase.firestore.FieldValue.serverTimestamp()});
    _toast('Marked as answered! 🎉','success');
  }

  async function _submitNewPrayer(){
    const nameEl=$('fc-prayer-submit-name'),textEl=$('fc-prayer-submit-text'),catEl=$('fc-prayer-submit-category'),confEl=$('fc-prayer-submit-confidential');
    const text=textEl?.value.trim()||''; if(!text){_toast('Please describe your prayer request.','error');return;}
    const ok=$('fc-modal-prayer-ok'); if(ok) ok.disabled=true;
    await _db.collection('prayers').add({submitterName:nameEl?.value.trim()||_me?.displayName||'Anonymous',submitterEmail:_me?.email||'',submitterUid:_me?.uid||'',prayerText:text,category:catEl?.value||'',isConfidential:confEl?.checked?'TRUE':'FALSE',status:'New',submittedAt:firebase.firestore.FieldValue.serverTimestamp()});
    _closeModal('fc-modal-prayer');
    if(nameEl)nameEl.value='';if(textEl)textEl.value='';if(catEl)catEl.value='';if(confEl)confEl.checked=false;if(ok)ok.disabled=false;
    _toast('Prayer request submitted 🙏','success');
  }

  /* ═══════════════════════════════════════════════════════════════════
     ANNOUNCEMENTS
  ═══════════════════════════════════════════════════════════════════ */
  function _startAnnounceListener(){
    if(_announceUnsub) return;
    _announceUnsub=_db.collection('broadcasts').orderBy('createdAt','desc').limit(50).onSnapshot(snap=>{
      _announces=snap.docs.map(d=>({id:d.id,...d.data()}));
      _renderAnnounceList();
    },()=>{});
  }

  function _renderAnnounceList(){
    const el=$('fc-announce-list'); if(!el) return;
    if(!_announces.length){el.innerHTML='<div class="fc-empty"><div class="fc-empty-icon">📢</div><p>No announcements yet.</p></div>';return;}
    el.innerHTML=_announces.map(a=>`<div class="fc-announce-item${_activeAnnounceId===a.id?' active':''}" data-id="${_e(a.id)}" tabindex="0" role="button">
      <div class="fc-announce-subject">${_e(a.subject||'Announcement')}</div>
      <div class="fc-announce-preview">${_e(a.body||a.message||'')}</div>
    </div>`).join('');
    el.querySelectorAll('.fc-announce-item').forEach(item=>{
      item.addEventListener('click',()=>_openAnnouncement(item.dataset.id));
      item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')_openAnnouncement(item.dataset.id);});
    });
  }

  function _openAnnouncement(announceId){
    _activeAnnounceId=announceId; _activePrayerId=null; _activeId=null;
    $$('.fc-announce-item').forEach(el=>el.classList.toggle('active',el.dataset.id===announceId));
    const ann=_announces.find(a=>a.id===announceId); if(!ann) return;
    _showPanel('fc-announce-panel');
    const tname=$('fc-topbar-room');if(tname)tname.textContent=ann.subject||'Announcement';
    const tdesc=$('fc-topbar-desc');if(tdesc)tdesc.textContent='';
    const detail=$('fc-announce-detail'); if(!detail) return;
    const ts=ann.createdAt?.toDate?.()||new Date();
    const tsStr=ts.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    detail.innerHTML=`
      <div class="fc-announce-badge">📢 Announcement</div>
      <h2 class="fc-announce-title">${_e(ann.subject||'Announcement')}</h2>
      <div class="fc-announce-body">${_e(ann.body||ann.message||'').replace(/\n/g,'<br>')}</div>
      <div class="fc-announce-meta">${ann.sentBy?'Posted by '+_e(ann.sentBy):''}${tsStr?' · '+_e(tsStr):''}</div>`;
    if(window.innerWidth<=640) _closeSidebar();
  }

  async function _submitAnnouncement(){
    const subjectEl=$('fc-announce-submit-subject'),bodyEl=$('fc-announce-submit-body');
    const subject=subjectEl?.value.trim()||'',body=bodyEl?.value.trim()||'';
    if(!subject){_toast('Please enter a subject.','error');return;}
    if(!body){_toast('Please write the announcement.','error');return;}
    const ok=$('fc-modal-announce-ok');if(ok)ok.disabled=true;
    await _db.collection('broadcasts').add({subject,body,sentBy:_me?.displayName||_me?.email||'Admin',sentByUid:_me?.uid||'',audience:'all',createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    _closeModal('fc-modal-announce');
    if(subjectEl)subjectEl.value='';if(bodyEl)bodyEl.value='';if(ok)ok.disabled=false;
    _toast('Announcement posted! 📢','success');
  }

  /* ═══════════════════════════════════════════════════════════════════
     ADMIN PANEL
  ═══════════════════════════════════════════════════════════════════ */
  async function _loadAdminUsersTab(){
    const container=$('fc-admin-users-list'); if(!container) return;
    container.innerHTML='<div class="fc-spinner"><div class="fc-spin"></div></div>';
    try{
      const snap=await _db.collection('users').get();
      if(snap.empty){container.innerHTML='<p class="fc-admin-empty">No users found.</p>';return;}
      container.innerHTML=snap.docs.map(d=>{
        const u=d.data();
        const roleOptions=ALL_ROLES.map(r=>`<option value="${r}"${u.role===r?' selected':''}>${ROLE_LABELS[r]}</option>`).join('');
        return `<div class="fc-admin-row" id="adrow-${d.id}">
          <div class="fc-admin-avatar">${_initials(u.displayName||u.email||'?')}</div>
          <div class="fc-admin-info"><div class="fc-admin-name">${_e(u.displayName||'(no name)')}</div><div class="fc-admin-email">${_e(u.email||d.id)}</div></div>
          <select class="fc-admin-role-sel" data-uid="${d.id}">${roleOptions}</select>
          ${d.id!==_me?.uid?`<button class="fc-admin-remove-btn" data-uid="${d.id}" data-name="${_e(u.displayName||u.email||d.id)}" title="Remove">🗑️</button>`:'<span style="opacity:0.4;font-size:0.75rem">You</span>'}
        </div>`;
      }).join('');
      container.querySelectorAll('.fc-admin-role-sel').forEach(sel=>{
        sel.addEventListener('change',async()=>{await _db.collection('users').doc(sel.dataset.uid).update({role:sel.value});_toast('Role updated.','success');});
      });
      container.querySelectorAll('.fc-admin-remove-btn').forEach(btn=>{
        btn.addEventListener('click',async()=>{
          _openConfirmModal('Remove User', `Remove ${_e(btn.dataset.name)} from this workspace?`, 'Remove', async () => {
            await _db.collection('users').doc(btn.dataset.uid).delete();
            $('adrow-'+btn.dataset.uid)?.remove();
            _toast(btn.dataset.name+' removed.');
          });
        });
      });
    }catch(err){container.innerHTML='<p style="color:var(--fc-danger)">Could not load users.</p>';console.error(err);}
  }

  async function _loadAdminChannelsTab(){
    const container=$('fc-admin-channels-list'); if(!container) return;
    container.innerHTML='<div class="fc-spinner"><div class="fc-spin"></div></div>';
    try{
      const snap=await _db.collection('channels').get();
      if(snap.empty){container.innerHTML='<p class="fc-admin-empty">No channels.</p>';return;}
      container.innerHTML=snap.docs.map(d=>{
        const ch=d.data();
        const accessOpts=['public','private','role-gated'].map(a=>`<option value="${a}"${(ch.access||'public')===a?' selected':''}>${a}</option>`).join('');
        return `<div class="fc-admin-row"><div class="fc-admin-info"><div class="fc-admin-name"># ${_e(ch.name)}</div><div class="fc-admin-email">${(ch.members||[]).length} member(s)</div></div><select class="fc-admin-access-sel" data-id="${d.id}">${accessOpts}</select></div>`;
      }).join('');
      container.querySelectorAll('.fc-admin-access-sel').forEach(sel=>{
        sel.addEventListener('change',async()=>{await _db.collection('channels').doc(sel.dataset.id).update({access:sel.value});_toast('Channel access updated.','success');});
      });
    }catch(err){container.innerHTML='<p style="color:var(--fc-danger)">Could not load channels.</p>';}
  }

  /* ═══════════════════════════════════════════════════════════════════
     PROFILE
  ═══════════════════════════════════════════════════════════════════ */
  function _openProfileModal(){
    const nameEl=$('fc-profile-name'),emailEl=$('fc-profile-email'),roleEl=$('fc-profile-role');
    if(nameEl)  nameEl.value=_me?.displayName||'';
    if(emailEl) emailEl.value=_me?.email||'';
    if(roleEl)  roleEl.value=_me?.role||'';
    _openModal('fc-modal-profile');
  }
  async function _saveProfile(){
    const nameEl=$('fc-profile-name'); const name=nameEl?.value.trim()||'';
    if(!name){_toast('Display name required.','error');return;}
    await _db.collection('users').doc(_me.uid).update({displayName:name});
    _me.displayName=name; _showApp();
    _closeModal('fc-modal-profile');
    _toast('Profile saved.','success');
  }

  /* ═══════════════════════════════════════════════════════════════════
     MODAL HELPERS
  ═══════════════════════════════════════════════════════════════════ */
  function _openModal(id){const el=$(id);if(el)el.removeAttribute('hidden');}
  function _closeModal(id){const el=$(id);if(el)el.setAttribute('hidden','');}

  /* Inline confirm modal — renders into body, calls onConfirm() on OK */
  function _openConfirmModal(title, msg, okLabel, onConfirm) {
    const id = 'fc-confirm-' + Date.now();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="fc-modal-backdrop">
        <div class="fc-modal" style="max-width:360px">
          <h3>${title}</h3>
          <p style="font-size:0.84rem;color:var(--fc-muted);line-height:1.5;margin:0 0 16px">${msg}</p>
          <div class="fc-modal-actions">
            <button class="fc-btn fc-btn--ghost" id="${id}-cancel">Cancel</button>
            <button class="fc-btn fc-btn--danger" id="${id}-ok">${okLabel || 'Confirm'}</button>
          </div>
        </div>
      </div>`);
    function _close() { document.getElementById(id)?.remove(); document.removeEventListener('keydown', _esc); }
    document.getElementById(`${id}-ok`).onclick     = () => { _close(); onConfirm(); };
    document.getElementById(`${id}-cancel`).onclick  = _close;
    // Clicking the backdrop (outside the modal box) dismisses it
    document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) _close(); });
    function _esc(e) { if (e.key === 'Escape') { e.preventDefault(); _close(); } }
    document.addEventListener('keydown', _esc);
  }

  /* ═══════════════════════════════════════════════════════════════════
     PANEL ROUTING
  ═══════════════════════════════════════════════════════════════════ */
  function _showPanel(panelId){
    ['fc-welcome','fc-thread','fc-prayer-panel','fc-announce-panel'].forEach(id=>{
      const el=$(id); if(!el) return;
      if(id===panelId){el.removeAttribute('hidden');el.style.display='';}
      else el.setAttribute('hidden','');
    });
  }
  function _showWelcome(){
    _showPanel('fc-welcome');
    const r=$('fc-topbar-room');if(r)r.textContent='';
    const d=$('fc-topbar-desc');if(d)d.textContent='';
  }

  /* ═══════════════════════════════════════════════════════════════════
     NEW CHANNEL / DM MODALS
  ═══════════════════════════════════════════════════════════════════ */
  async function _submitNewChannel(){
    const nameEl=$('fc-new-ch-name'),descEl=$('fc-new-ch-desc'),accessEl=$('fc-new-ch-access');
    const name=(nameEl?.value.trim()||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    const desc=descEl?.value.trim()||'', access=accessEl?.value||'public';
    if(!name){_toast('Please enter a channel name.','error');return;}
    const ok=$('fc-modal-channel-ok');if(ok)ok.disabled=true;
    await _db.collection('channels').add({name,description:desc,access,createdBy:_me.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp(),members:[_me.uid],messageCount:0,pins:[]});
    _closeModal('fc-modal-channel');
    if(nameEl)nameEl.value='';if(descEl)descEl.value='';if(ok)ok.disabled=false;
    _toast('Channel #'+name+' created!','success');
  }

  async function _submitNewDM(){
    const emailEl=$('fc-dm-target-email');
    const email=emailEl?.value.trim().toLowerCase()||'';
    if(!email){_toast('Please enter an email address.','error');return;}
    if(email===_me?.email?.toLowerCase()){_toast("You can't DM yourself.",'error');return;}
    const snap=await _db.collection('users').where('email','==',email).limit(1).get();
    if(snap.empty){_toast('No user found with that email.','error');return;}
    const targetUid=snap.docs[0].id;
    const targetName=snap.docs[0].data().displayName||email;
    const existing=_dms.find(d=>(d.members||[]).includes(targetUid));
    if(existing){_closeModal('fc-modal-dm');_switchTab('dms');_openDM(existing,targetName);return;}
    const ok=$('fc-modal-dm-ok');if(ok)ok.disabled=true;
    const dmRef=await _db.collection('dms').add({members:[_me.uid,targetUid],otherName:targetName,createdAt:firebase.firestore.FieldValue.serverTimestamp(),lastTimestamp:firebase.firestore.FieldValue.serverTimestamp()});
    _closeModal('fc-modal-dm');if(emailEl)emailEl.value='';if(ok)ok.disabled=false;
    _switchTab('dms');
    setTimeout(()=>_openDM({id:dmRef.id,members:[_me.uid,targetUid]},targetName),300);
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI EVENT BINDING
  ═══════════════════════════════════════════════════════════════════ */
  function _bindUI(){
    $('fc-signout-btn')?.addEventListener('click',()=>window.Nehemiah?.logout?.());
    $$('.fc-tab').forEach(btn=>btn.addEventListener('click',()=>_switchTab(btn.dataset.tab)));
    $('fc-sidebar-search')?.addEventListener('input',()=>{_renderChannelList();_renderDMList();});
    $('fc-menu-toggle')?.addEventListener('click',_toggleSidebar);
    $('fc-sidebar-scrim')?.addEventListener('click',_closeSidebar);
    document.querySelector('.fc-main')?.addEventListener('click',()=>{if(window.innerWidth<=640)_closeSidebar();});

    // Composer
    const inp=$('fc-composer-input'), sendBtn=$('fc-send-btn');
    if(inp){
      inp.addEventListener('input',()=>{inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,140)+'px';if(sendBtn)sendBtn.disabled=!inp.value.trim();_startTyping();});
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(inp.value.trim())_sendMessage();}});
    }
    if(sendBtn) sendBtn.addEventListener('click',_sendMessage);

    // Reply bar
    $('fc-reply-cancel-btn')?.addEventListener('click',_clearReplyTarget);

    // Emoji
    $('fc-emoji-btn')?.addEventListener('click',e=>{e.stopPropagation();_emojiTarget=null;_showEmojiPicker(e,null);});
    _buildEmojiPicker();

    // Search
    $('fc-search-btn')?.addEventListener('click',_toggleSearch);
    $('fc-search-close-btn')?.addEventListener('click',_closeSearch);
    $('fc-search-input')?.addEventListener('input',e=>{_searchQuery=e.target.value;_renderMessages(_msgDocs);});

    // Details pane
    $('fc-details-toggle-btn')?.addEventListener('click',()=>{_detailsOpen=!_detailsOpen;$('fc-details-pane')?.classList.toggle('collapsed',!_detailsOpen);});
    $('fc-details-close-btn')?.addEventListener('click',()=>{_detailsOpen=false;$('fc-details-pane')?.classList.add('collapsed');});

    // Prayer
    $('fc-mark-answered-btn')?.addEventListener('click',_markPrayerAnswered);
    $('fc-new-prayer-btn')?.addEventListener('click',()=>_openModal('fc-modal-prayer'));
    $('fc-modal-prayer-cancel')?.addEventListener('click',()=>_closeModal('fc-modal-prayer'));
    $('fc-modal-prayer-ok')?.addEventListener('click',_submitNewPrayer);

    // Announcements
    $('fc-new-announce-btn')?.addEventListener('click',()=>_openModal('fc-modal-announce'));
    $('fc-modal-announce-cancel')?.addEventListener('click',()=>_closeModal('fc-modal-announce'));
    $('fc-modal-announce-ok')?.addEventListener('click',_submitAnnouncement);

    // New channel
    $('fc-new-channel-btn')?.addEventListener('click',()=>_openModal('fc-modal-channel'));
    $('fc-modal-channel-cancel')?.addEventListener('click',()=>_closeModal('fc-modal-channel'));
    $('fc-modal-channel-ok')?.addEventListener('click',_submitNewChannel);

    // New DM
    $('fc-new-dm-btn')?.addEventListener('click',()=>_openModal('fc-modal-dm'));
    $('fc-modal-dm-cancel')?.addEventListener('click',()=>_closeModal('fc-modal-dm'));
    $('fc-modal-dm-ok')?.addEventListener('click',_submitNewDM);

    // Admin panel
    $('fc-admin-menu-btn')?.addEventListener('click',()=>{_openModal('fc-modal-admin');_loadAdminUsersTab();});
    $('fc-admin-close-btn')?.addEventListener('click',()=>_closeModal('fc-modal-admin'));
    $$('.fc-admin-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        $$('.fc-admin-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        if($('fc-admin-tab-users'))    $('fc-admin-tab-users').style.display=btn.dataset.tab==='users'?'':'none';
        if($('fc-admin-tab-channels')) $('fc-admin-tab-channels').style.display=btn.dataset.tab==='channels'?'':'none';
        if(btn.dataset.tab==='users')    _loadAdminUsersTab();
        if(btn.dataset.tab==='channels') _loadAdminChannelsTab();
      });
    });

    // Profile
    $('fc-user-chip')?.addEventListener('click',_openProfileModal);
    $('fc-profile-cancel-btn')?.addEventListener('click',()=>_closeModal('fc-modal-profile'));
    $('fc-profile-save-btn')?.addEventListener('click',_saveProfile);

    // Modal backdrop
    $$('.fc-modal-backdrop').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.setAttribute('hidden','');}));

    // Quick switcher (Ctrl+K) + search (Ctrl+F) + Escape
    document.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();_qsVisible?_closeQuickSwitcher():_openQuickSwitcher();}
      if((e.ctrlKey||e.metaKey)&&e.key==='f'){e.preventDefault();_toggleSearch();}
      if(e.key==='Escape'){
        if(_qsVisible) _closeQuickSwitcher();
        else if(_searchActive) _closeSearch();
        else _closeEmojiPicker();
      }
    });
    $('fc-qs-input')?.addEventListener('input',e=>_renderQSList(e.target.value));
    $('fc-quick-switcher')?.addEventListener('click',e=>{if(e.target===$('fc-quick-switcher'))_closeQuickSwitcher();});
  }

  /* ═══════════════════════════════════════════════════════════════════
     SIDEBAR (mobile)
  ═══════════════════════════════════════════════════════════════════ */
  function _toggleSidebar(){
    const sb=$('fc-sidebar'); if(sb) sb.classList.toggle('open');
    const sc=$('fc-sidebar-scrim'); if(sc) sc.classList.toggle('open',!!$('fc-sidebar')?.classList.contains('open'));
  }
  function _closeSidebar(){
    $('fc-sidebar')?.classList.remove('open');
    $('fc-sidebar-scrim')?.classList.remove('open');
  }

  /* ═══════════════════════════════════════════════════════════════════
     WAIT HELPER
  ═══════════════════════════════════════════════════════════════════ */
  function _waitFor(fn,ms){
    ms=ms||8000;
    return new Promise((resolve,reject)=>{
      const start=Date.now();
      (function check(){
        if(fn()) return resolve();
        if(Date.now()-start>ms) return reject(new Error('Timeout waiting for dependency'));
        setTimeout(check,60);
      })();
    });
  }

})();
