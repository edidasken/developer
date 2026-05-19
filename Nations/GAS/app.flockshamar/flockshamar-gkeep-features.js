/**
 * FlockShamar - Google Keep Feature Parity Module
 * Adds comprehensive note-taking features to match Google Keep functionality
 */

(function() {
  'use strict';

  // Feature state
  const KeepFeatures = {
    notes: new Map(),
    labels: new Set(),
    currentNote: null,
    selectedNotes: new Set(),
    colorPalette: [
      { name: 'Default', color: '#202124' },
      { name: 'Red', color: '#5c2b29' },
      { name: 'Orange', color: '#614a19' },
      { name: 'Yellow', color: '#635d19' },
      { name: 'Green', color: '#345920' },
      { name: 'Teal', color: '#16504b' },
      { name: 'Blue', color: '#2d555e' },
      { name: 'Dark Blue', color: '#1e3a5f' },
      { name: 'Purple', color: '#42275e' },
      { name: 'Pink', color: '#5b2245' },
      { name: 'Brown', color: '#442f19' },
      { name: 'Gray', color: '#3c3f43' }
    ],
    reminders: new Map(),
    sharedNotes: new Map(),
    archivedNotes: new Set(),
    pinnedNotes: new Set(),
    audioRecorder: null,
    drawingCanvas: null,
  };

  // Initialize all Google Keep features
  function initializeGoogleKeepFeatures() {
    console.log('[FlockShamar Keep] Initializing Google Keep features...');
    
    setupTextNotes();
    setupListNotes();
    setupImageNotes();
    setupAudioNotes();
    setupDrawingNotes();
    setupLabels();
    setupColorCoding();
    setupPinning();
    setupArchiving();
    setupSearch();
    setupTimeReminders();
    setupLocationReminders();
    setupSharedNotes();
    setupSidebarIntegration();
    setupCopyToFlockDocs();
    setupCrossDeviceSync();
    setupKeyboardShortcuts();
    
    console.log('[FlockShamar Keep] All Google Keep features initialized');
  }

  // ============================================================================
  // NOTE CREATION
  // ============================================================================

  function setupTextNotes() {
    const newNoteBtn = document.getElementById('fs-new-note-btn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => createTextNote());
    }

    // Click to expand note input
    const noteInput = document.getElementById('fs-note-input');
    if (noteInput) {
      noteInput.addEventListener('focus', expandNoteInput);
    }
  }

  function createTextNote(title = '', content = '') {
    const note = {
      id: generateNoteId(),
      type: 'text',
      title,
      content,
      color: '#202124',
      labels: [],
      isPinned: false,
      isArchived: false,
      reminders: [],
      sharedWith: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    KeepFeatures.notes.set(note.id, note);
    saveToFirebase(note);
    renderNote(note);
    return note;
  }

  function expandNoteInput() {
    const noteInputArea = document.getElementById('fs-note-input-area');
    if (noteInputArea) {
      noteInputArea.classList.add('expanded');
      
      // Show title input and action buttons
      const titleInput = document.getElementById('fs-note-title-input');
      const actionBar = document.getElementById('fs-note-input-actions');
      if (titleInput) titleInput.style.display = 'block';
      if (actionBar) actionBar.style.display = 'flex';
    }
  }

  function setupListNotes() {
    window.createListNote = (title = 'New List') => {
      const note = {
        id: generateNoteId(),
        type: 'list',
        title,
        items: [
          { id: Date.now(), text: '', checked: false, indent: 0 }
        ],
        color: '#202124',
        labels: [],
        isPinned: false,
        isArchived: false,
        reminders: [],
        sharedWith: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      KeepFeatures.notes.set(note.id, note);
      saveToFirebase(note);
      renderNote(note);
      return note;
    };

    // Add list item
    window.addListItem = (noteId, text = '', afterItemId = null) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note || note.type !== 'list') return;

      const newItem = {
        id: Date.now(),
        text,
        checked: false,
        indent: 0
      };

      if (afterItemId) {
        const index = note.items.findIndex(item => item.id === afterItemId);
        note.items.splice(index + 1, 0, newItem);
      } else {
        note.items.push(newItem);
      }

      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
    };

    // Check/uncheck list item
    window.toggleListItem = (noteId, itemId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note || note.type !== 'list') return;

      const item = note.items.find(i => i.id === itemId);
      if (item) {
        item.checked = !item.checked;
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
      }
    };

    // Indent/outdent list item
    window.indentListItem = (noteId, itemId, direction) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note || note.type !== 'list') return;

      const item = note.items.find(i => i.id === itemId);
      if (item) {
        if (direction === 'in') {
          item.indent = Math.min(item.indent + 1, 3);
        } else {
          item.indent = Math.max(item.indent - 1, 0);
        }
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
      }
    };

    // Reorder list items (drag and drop)
    window.reorderListItem = (noteId, itemId, newIndex) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note || note.type !== 'list') return;

      const oldIndex = note.items.findIndex(i => i.id === itemId);
      const item = note.items.splice(oldIndex, 1)[0];
      note.items.splice(newIndex, 0, item);

      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
    };
  }

  function setupImageNotes() {
    window.createImageNote = (imageUrl, title = 'Image Note') => {
      const note = {
        id: generateNoteId(),
        type: 'image',
        title,
        content: '',
        imageUrl,
        imageData: null,
        ocrText: '',
        color: '#202124',
        labels: [],
        isPinned: false,
        isArchived: false,
        reminders: [],
        sharedWith: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      KeepFeatures.notes.set(note.id, note);
      
      // Perform OCR on the image
      performOCR(note);
      
      saveToFirebase(note);
      renderNote(note);
      return note;
    };

    // Upload image handler
    const imageInput = document.getElementById('fs-image-upload');
    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            createImageNote(event.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  function performOCR(note) {
    // Using Tesseract.js for OCR (would need to be loaded)
    if (typeof Tesseract !== 'undefined') {
      Tesseract.recognize(note.imageUrl, 'eng')
        .then(({ data: { text } }) => {
          note.ocrText = text;
          note.updatedAt = new Date().toISOString();
          saveToFirebase(note);
          console.log('[FlockShamar Keep] OCR extracted:', text);
        });
    } else {
      console.log('[FlockShamar Keep] Tesseract.js not loaded - OCR unavailable');
    }
  }

  function setupAudioNotes() {
    let mediaRecorder;
    let audioChunks = [];

    window.startAudioRecording = () => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Create audio note
            const note = {
              id: generateNoteId(),
              type: 'audio',
              title: 'Voice Note',
              content: '',
              audioUrl,
              audioBlob,
              transcript: '',
              color: '#202124',
              labels: [],
              isPinned: false,
              isArchived: false,
              reminders: [],
              sharedWith: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            KeepFeatures.notes.set(note.id, note);
            
            // Transcribe audio
            transcribeAudio(note);
            
            saveToFirebase(note);
            renderNote(note);
          };

          mediaRecorder.start();
          KeepFeatures.audioRecorder = mediaRecorder;
          
          // Update UI to show recording
          showRecordingIndicator();
        })
        .catch(err => {
          console.error('[FlockShamar Keep] Audio recording error:', err);
        });
    };

    window.stopAudioRecording = () => {
      if (KeepFeatures.audioRecorder && KeepFeatures.audioRecorder.state === 'recording') {
        KeepFeatures.audioRecorder.stop();
        hideRecordingIndicator();
      }
    };
  }

  function transcribeAudio(note) {
    // Using Web Speech API for transcription
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(' ');
        
        note.transcript = transcript;
        note.content = transcript;
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
      };

      // Note: This would need the audio to be played back for recognition
      console.log('[FlockShamar Keep] Audio transcription would happen here');
    } else {
      console.log('[FlockShamar Keep] Speech recognition not supported');
    }
  }

  function setupDrawingNotes() {
    window.createDrawingNote = () => {
      const note = {
        id: generateNoteId(),
        type: 'drawing',
        title: 'Drawing',
        content: '',
        drawingData: null,
        color: '#202124',
        labels: [],
        isPinned: false,
        isArchived: false,
        reminders: [],
        sharedWith: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      KeepFeatures.notes.set(note.id, note);
      saveToFirebase(note);
      
      // Open drawing canvas
      openDrawingCanvas(note);
      
      return note;
    };
  }

  function openDrawingCanvas(note) {
    const modal = document.createElement('div');
    modal.className = 'fs-drawing-modal';
    modal.innerHTML = `
      <div class="fs-drawing-container">
        <div class="fs-drawing-header">
          <h3>Drawing</h3>
          <button onclick="closeDrawingCanvas()">Done</button>
        </div>
        <canvas id="fs-drawing-canvas" width="800" height="600"></canvas>
        <div class="fs-drawing-toolbar">
          <button data-tool="pen">Pen</button>
          <button data-tool="eraser">Eraser</button>
          <input type="color" id="fs-pen-color" value="#ffffff">
          <input type="range" id="fs-pen-width" min="1" max="10" value="3">
          <button onclick="clearDrawing()">Clear</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const canvas = document.getElementById('fs-drawing-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let currentTool = 'pen';
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    function startDrawing(e) {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    function draw(e) {
      if (!isDrawing) return;
      
      const rect = canvas.getBoundingClientRect();
      const penColor = document.getElementById('fs-pen-color').value;
      const penWidth = document.getElementById('fs-pen-width').value;
      
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      
      if (currentTool === 'pen') {
        ctx.strokeStyle = penColor;
      } else {
        ctx.strokeStyle = '#202124';
        ctx.lineWidth = 20;
      }
      
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }

    function stopDrawing() {
      if (isDrawing) {
        isDrawing = false;
        // Save drawing data
        note.drawingData = canvas.toDataURL();
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
      }
    }

    window.closeDrawingCanvas = () => {
      modal.remove();
      renderNote(note);
    };

    window.clearDrawing = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Tool selection
    modal.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentTool = e.target.dataset.tool;
        modal.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
      });
    });
  }

  // ============================================================================
  // ORGANIZATION & DISCOVERY
  // ============================================================================

  function setupLabels() {
    window.addLabel = (labelName) => {
      KeepFeatures.labels.add(labelName);
      saveLabelsToStorage();
      updateLabelsSidebar();
    };

    window.addLabelToNote = (noteId, labelName) => {
      const note = KeepFeatures.notes.get(noteId);
      if (note && !note.labels.includes(labelName)) {
        note.labels.push(labelName);
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
        
        // Add to global labels
        KeepFeatures.labels.add(labelName);
        saveLabelsToStorage();
        updateLabelsSidebar();
      }
    };

    window.removeLabelFromNote = (noteId, labelName) => {
      const note = KeepFeatures.notes.get(noteId);
      if (note) {
        note.labels = note.labels.filter(l => l !== labelName);
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
      }
    };

    // Filter notes by label
    window.filterByLabel = (labelName) => {
      const filtered = Array.from(KeepFeatures.notes.values())
        .filter(note => note.labels.includes(labelName));
      renderFilteredNotes(filtered);
    };
  }

  function setupColorCoding() {
    window.setNoteColor = (noteId, colorName) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      const colorObj = KeepFeatures.colorPalette.find(c => c.name === colorName);
      if (colorObj) {
        note.color = colorObj.color;
        note.updatedAt = new Date().toISOString();
        saveToFirebase(note);
        renderNote(note);
      }
    };

    window.showColorPicker = (noteId) => {
      const colorMenu = document.createElement('div');
      colorMenu.className = 'fs-color-picker-menu';
      
      KeepFeatures.colorPalette.forEach(color => {
        const colorBtn = document.createElement('div');
        colorBtn.className = 'fs-color-btn';
        colorBtn.style.backgroundColor = color.color;
        colorBtn.title = color.name;
        colorBtn.onclick = () => {
          setNoteColor(noteId, color.name);
          colorMenu.remove();
        };
        colorMenu.appendChild(colorBtn);
      });
      
      document.body.appendChild(colorMenu);
      
      // Position near the note
      const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteElement) {
        const rect = noteElement.getBoundingClientRect();
        colorMenu.style.top = rect.bottom + 'px';
        colorMenu.style.left = rect.left + 'px';
      }
      
      // Close on outside click
      setTimeout(() => {
        document.addEventListener('click', (e) => {
          if (!colorMenu.contains(e.target)) {
            colorMenu.remove();
          }
        }, { once: true });
      }, 100);
    };
  }

  function setupPinning() {
    window.togglePinNote = (noteId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      note.isPinned = !note.isPinned;
      
      if (note.isPinned) {
        KeepFeatures.pinnedNotes.add(noteId);
      } else {
        KeepFeatures.pinnedNotes.delete(noteId);
      }

      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      rerenderAllNotes();
    };
  }

  function setupArchiving() {
    window.archiveNote = (noteId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      note.isArchived = true;
      KeepFeatures.archivedNotes.add(noteId);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      
      // Remove from main view
      const noteElement = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteElement) noteElement.remove();
    };

    window.unarchiveNote = (noteId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      note.isArchived = false;
      KeepFeatures.archivedNotes.delete(noteId);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
    };

    window.showArchive = () => {
      const archived = Array.from(KeepFeatures.notes.values())
        .filter(note => note.isArchived);
      renderFilteredNotes(archived, 'Archive');
    };
  }

  function setupSearch() {
    const searchInput = document.getElementById('fs-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
      });
    }

    // Advanced search filters
    window.performSearch = (query) => {
      const lowerQuery = query.toLowerCase();
      
      const results = Array.from(KeepFeatures.notes.values()).filter(note => {
        // Search in title
        if (note.title.toLowerCase().includes(lowerQuery)) return true;
        
        // Search in content
        if (note.content.toLowerCase().includes(lowerQuery)) return true;
        
        // Search in labels
        if (note.labels.some(label => label.toLowerCase().includes(lowerQuery))) return true;
        
        // Search in OCR text
        if (note.ocrText && note.ocrText.toLowerCase().includes(lowerQuery)) return true;
        
        // Search in audio transcript
        if (note.transcript && note.transcript.toLowerCase().includes(lowerQuery)) return true;
        
        // Search in list items
        if (note.type === 'list') {
          if (note.items.some(item => item.text.toLowerCase().includes(lowerQuery))) return true;
        }
        
        return false;
      });
      
      renderFilteredNotes(results);
    };

    // Filter by type
    window.filterByType = (type) => {
      const filtered = Array.from(KeepFeatures.notes.values())
        .filter(note => note.type === type);
      renderFilteredNotes(filtered, `${type} notes`);
    };

    // Filter by color
    window.filterByColor = (colorName) => {
      const colorObj = KeepFeatures.colorPalette.find(c => c.name === colorName);
      if (colorObj) {
        const filtered = Array.from(KeepFeatures.notes.values())
          .filter(note => note.color === colorObj.color);
        renderFilteredNotes(filtered, `${colorName} notes`);
      }
    };
  }

  // ============================================================================
  // REMINDERS & COLLABORATION
  // ============================================================================

  function setupTimeReminders() {
    window.addTimeReminder = (noteId, datetime) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      const reminder = {
        id: Date.now(),
        type: 'time',
        datetime,
        triggered: false
      };

      note.reminders.push(reminder);
      KeepFeatures.reminders.set(reminder.id, { noteId, reminder });
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
      
      // Schedule notification
      scheduleNotification(noteId, reminder);
    };

    window.removeReminder = (noteId, reminderId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      note.reminders = note.reminders.filter(r => r.id !== reminderId);
      KeepFeatures.reminders.delete(reminderId);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
    };
  }

  function scheduleNotification(noteId, reminder) {
    const now = new Date().getTime();
    const targetTime = new Date(reminder.datetime).getTime();
    const delay = targetTime - now;

    if (delay > 0) {
      setTimeout(() => {
        if (!reminder.triggered) {
          showNotification(noteId, reminder);
          reminder.triggered = true;
        }
      }, delay);
    }
  }

  function showNotification(noteId, reminder) {
    const note = KeepFeatures.notes.get(noteId);
    if (!note) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FlockShamar Reminder', {
        body: note.title || note.content.substring(0, 100),
        icon: '/Images/logo.png',
        tag: noteId
      });
    }
  }

  function setupLocationReminders() {
    window.addLocationReminder = (noteId, location, radius = 100) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      const reminder = {
        id: Date.now(),
        type: 'location',
        location, // { lat, lng, name }
        radius, // meters
        triggered: false
      };

      note.reminders.push(reminder);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
      
      // Start geolocation monitoring
      startGeofenceMonitoring(noteId, reminder);
    };
  }

  function startGeofenceMonitoring(noteId, reminder) {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const distance = calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            reminder.location.lat,
            reminder.location.lng
          );

          if (distance <= reminder.radius && !reminder.triggered) {
            showNotification(noteId, reminder);
            reminder.triggered = true;
            navigator.geolocation.clearWatch(watchId);
          }
        },
        (error) => {
          console.error('[FlockShamar Keep] Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
          timeout: 27000
        }
      );
    }
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  function setupSharedNotes() {
    window.shareNote = (noteId, userEmail, permission = 'edit') => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      const shareInfo = {
        email: userEmail,
        permission, // 'view' or 'edit'
        sharedAt: new Date().toISOString()
      };

      note.sharedWith.push(shareInfo);
      KeepFeatures.sharedNotes.set(noteId, note.sharedWith);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      
      // Send notification to collaborator
      sendShareNotification(noteId, userEmail);
    };

    window.unshareNote = (noteId, userEmail) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      note.sharedWith = note.sharedWith.filter(s => s.email !== userEmail);
      
      note.updatedAt = new Date().toISOString();
      saveToFirebase(note);
      renderNote(note);
    };
  }

  function sendShareNotification(noteId, userEmail) {
    // Would send email via Firebase Functions
    console.log(`[FlockShamar Keep] Sharing note ${noteId} with ${userEmail}`);
  }

  // ============================================================================
  // INTEGRATIONS
  // ============================================================================

  function setupSidebarIntegration() {
    // Create sidebar panel for other apps
    window.FlockShamarSidebar = {
      show: () => {
        const sidebar = document.createElement('div');
        sidebar.id = 'fs-sidebar-panel';
        sidebar.className = 'fs-sidebar-panel';
        sidebar.innerHTML = `
          <div class="fs-sidebar-header">
            <h3>FlockShamar</h3>
            <button onclick="FlockShamarSidebar.hide()">×</button>
          </div>
          <div class="fs-sidebar-content" id="fs-sidebar-notes">
            <!-- Notes will be rendered here -->
          </div>
          <div class="fs-sidebar-footer">
            <button onclick="createTextNote()">+ Take a note</button>
          </div>
        `;
        document.body.appendChild(sidebar);
        
        // Render recent notes
        renderSidebarNotes();
      },
      
      hide: () => {
        const sidebar = document.getElementById('fs-sidebar-panel');
        if (sidebar) sidebar.remove();
      },
      
      toggle: () => {
        const sidebar = document.getElementById('fs-sidebar-panel');
        if (sidebar) {
          FlockShamarSidebar.hide();
        } else {
          FlockShamarSidebar.show();
        }
      }
    };

    window.FlockShamarSidebar = window.FlockShamarSidebar;
  }

  function renderSidebarNotes() {
    const container = document.getElementById('fs-sidebar-notes');
    if (!container) return;

    const recentNotes = Array.from(KeepFeatures.notes.values())
      .filter(note => !note.isArchived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10);

    container.innerHTML = recentNotes.map(note => `
      <div class="fs-sidebar-note" onclick="openNoteInSidebar('${note.id}')">
        <div class="fs-sidebar-note-title">${note.title || 'Untitled'}</div>
        <div class="fs-sidebar-note-preview">${note.content.substring(0, 50)}...</div>
      </div>
    `).join('');
  }

  function setupCopyToFlockDocs() {
    window.copyNoteToFlockDocs = (noteId) => {
      const note = KeepFeatures.notes.get(noteId);
      if (!note) return;

      let docContent = `<h1>${note.title || 'Untitled'}</h1>`;
      
      if (note.type === 'text') {
        docContent += `<p>${note.content}</p>`;
      } else if (note.type === 'list') {
        docContent += '<ul>';
        note.items.forEach(item => {
          const checked = item.checked ? 'checked' : '';
          docContent += `<li><input type="checkbox" ${checked}> ${item.text}</li>`;
        });
        docContent += '</ul>';
      } else if (note.type === 'image') {
        docContent += `<img src="${note.imageUrl}" alt="${note.title}">`;
        if (note.content) docContent += `<p>${note.content}</p>`;
      }

      // Create FlockDocs document
      if (window.FlockDocs && window.FlockDocs.createDocument) {
        window.FlockDocs.createDocument({
          title: note.title || 'Untitled',
          content: docContent,
          source: 'FlockShamar'
        });
        
        alert('Note copied to FlockDocs!');
      } else {
        console.error('[FlockShamar Keep] FlockDocs not available');
      }
    };
  }

  function setupCrossDeviceSync() {
    // Real-time Firebase sync
    if (window.firebase && window.firebase.firestore) {
      const db = firebase.firestore();
      const notesRef = db.collection('flockshamar_notes');

      // Listen for remote changes
      notesRef.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const noteData = change.doc.data();
            KeepFeatures.notes.set(change.doc.id, noteData);
            renderNote(noteData);
          } else if (change.type === 'removed') {
            KeepFeatures.notes.delete(change.doc.id);
            const noteElement = document.querySelector(`[data-note-id="${change.doc.id}"]`);
            if (noteElement) noteElement.remove();
          }
        });
      });
    }
  }

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + N = New text note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createTextNote();
      }

      // Ctrl/Cmd + Shift + N = New list
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        createListNote();
      }

      // Ctrl/Cmd + K = Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('fs-search-input');
        if (searchInput) searchInput.focus();
      }
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function generateNoteId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function renderNote(note) {
    const container = document.getElementById('fs-notes-grid');
    if (!container) return;

    let noteElement = document.querySelector(`[data-note-id="${note.id}"]`);
    
    if (!noteElement) {
      noteElement = document.createElement('div');
      noteElement.className = 'fs-note-card';
      noteElement.dataset.noteId = note.id;
      container.appendChild(noteElement);
    }

    noteElement.style.backgroundColor = note.color;
    
    let content = `
      <div class="fs-note-header">
        <h3 class="fs-note-title">${note.title || ''}</h3>
        <button class="fs-note-pin ${note.isPinned ? 'pinned' : ''}" 
                onclick="togglePinNote('${note.id}')">📌</button>
      </div>
    `;

    if (note.type === 'text') {
      content += `<div class="fs-note-content">${note.content}</div>`;
    } else if (note.type === 'list') {
      content += '<ul class="fs-note-list">';
      note.items.forEach(item => {
        content += `
          <li class="fs-list-item" style="margin-left: ${item.indent * 20}px">
            <input type="checkbox" ${item.checked ? 'checked' : ''} 
                   onchange="toggleListItem('${note.id}', ${item.id})">
            <span class="${item.checked ? 'checked' : ''}">${item.text}</span>
          </li>
        `;
      });
      content += '</ul>';
    } else if (note.type === 'image') {
      content += `
        <img src="${note.imageUrl}" class="fs-note-image" alt="${note.title}">
        <div class="fs-note-content">${note.content}</div>
      `;
    } else if (note.type === 'audio') {
      content += `
        <audio controls src="${note.audioUrl}"></audio>
        <div class="fs-note-content">${note.transcript || note.content}</div>
      `;
    } else if (note.type === 'drawing') {
      content += `<img src="${note.drawingData}" class="fs-note-drawing" alt="Drawing">`;
    }

    // Labels
    if (note.labels.length > 0) {
      content += '<div class="fs-note-labels">';
      note.labels.forEach(label => {
        content += `<span class="fs-label-chip">${label}</span>`;
      });
      content += '</div>';
    }

    // Reminders
    if (note.reminders.length > 0) {
      content += '<div class="fs-note-reminders">';
      note.reminders.forEach(reminder => {
        if (reminder.type === 'time') {
          content += `<span class="fs-reminder-chip">⏰ ${new Date(reminder.datetime).toLocaleString()}</span>`;
        } else {
          content += `<span class="fs-reminder-chip">📍 ${reminder.location.name}</span>`;
        }
      });
      content += '</div>';
    }

    // Footer actions
    content += `
      <div class="fs-note-footer">
        <button onclick="showColorPicker('${note.id}')" title="Change color">🎨</button>
        <button onclick="archiveNote('${note.id}')" title="Archive">📦</button>
        <button onclick="copyNoteToFlockDocs('${note.id}')" title="Copy to FlockDocs">📄</button>
      </div>
    `;

    noteElement.innerHTML = content;
  }

  function renderFilteredNotes(notes, title = 'Search Results') {
    const container = document.getElementById('fs-notes-grid');
    if (!container) return;

    container.innerHTML = '';
    
    const header = document.createElement('h2');
    header.textContent = title;
    container.appendChild(header);

    notes.forEach(note => renderNote(note));
  }

  function rerenderAllNotes() {
    const container = document.getElementById('fs-notes-grid');
    if (!container) return;

    container.innerHTML = '';
    
    // Render pinned notes first
    const pinned = Array.from(KeepFeatures.notes.values())
      .filter(note => note.isPinned && !note.isArchived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    if (pinned.length > 0) {
      const pinnedSection = document.createElement('div');
      pinnedSection.className = 'fs-notes-section';
      pinnedSection.innerHTML = '<h2>Pinned</h2>';
      container.appendChild(pinnedSection);
      pinned.forEach(note => renderNote(note));
    }

    // Render other notes
    const other = Array.from(KeepFeatures.notes.values())
      .filter(note => !note.isPinned && !note.isArchived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    if (other.length > 0) {
      const otherSection = document.createElement('div');
      otherSection.className = 'fs-notes-section';
      otherSection.innerHTML = '<h2>Others</h2>';
      container.appendChild(otherSection);
      other.forEach(note => renderNote(note));
    }
  }

  function saveToFirebase(note) {
    if (window.firebase && window.firebase.firestore) {
      const db = firebase.firestore();
      db.collection('flockshamar_notes').doc(note.id).set(note)
        .catch(err => console.error('[FlockShamar Keep] Save error:', err));
    }
  }

  function saveLabelsToStorage() {
    localStorage.setItem('flockshamar-labels', JSON.stringify(Array.from(KeepFeatures.labels)));
  }

  function updateLabelsSidebar() {
    // Update labels in sidebar
    console.log('[FlockShamar Keep] Labels updated:', Array.from(KeepFeatures.labels));
  }

  function showRecordingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'fs-recording-indicator';
    indicator.className = 'fs-recording-indicator';
    indicator.innerHTML = '🔴 Recording...';
    document.body.appendChild(indicator);
  }

  function hideRecordingIndicator() {
    const indicator = document.getElementById('fs-recording-indicator');
    if (indicator) indicator.remove();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeGoogleKeepFeatures, 500);
    });
  } else {
    setTimeout(initializeGoogleKeepFeatures, 500);
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Export for external access
  window.FlockShamarFeatures = KeepFeatures;

})();
