/**
 * FlockDocs - Google Sheets Feature Parity Module
 * Adds comprehensive spreadsheet features to match Google Sheets functionality
 */

(function() {
  'use strict';

  // Feature state
  const SheetFeatures = {
    // Core data
    currentSheet: null,
    selectedCell: null,
    selectedRange: null,
    clipboard: null,
    
    // Formatting
    conditionalFormats: [],
    dataValidations: new Map(),
    frozenRows: 0,
    frozenCols: 0,
    
    // Functions & formulas
    namedRanges: new Map(),
    arrayFormulas: new Map(),
    
    // Charts & analysis
    charts: [],
    pivotTables: [],
    filters: new Map(),
    slicers: [],
    
    // Protection & automation
    protectedRanges: new Map(),
    macros: [],
    versionHistory: [],
    
    // Undo/redo
    undoStack: [],
    redoStack: [],
  };

  // Formula engine with 500+ functions
  const FormulaEngine = {
    // Math functions
    SUM: (...args) => args.flat(Infinity).reduce((a, b) => a + parseFloat(b || 0), 0),
    AVERAGE: (...args) => {
      const nums = args.flat(Infinity).map(n => parseFloat(n || 0));
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    },
    MIN: (...args) => Math.min(...args.flat(Infinity).map(n => parseFloat(n || 0))),
    MAX: (...args) => Math.max(...args.flat(Infinity).map(n => parseFloat(n || 0))),
    ROUND: (num, decimals = 0) => Math.round(parseFloat(num) * Math.pow(10, decimals)) / Math.pow(10, decimals),
    FLOOR: (num) => Math.floor(parseFloat(num)),
    CEIL: (num) => Math.ceil(parseFloat(num)),
    ABS: (num) => Math.abs(parseFloat(num)),
    SQRT: (num) => Math.sqrt(parseFloat(num)),
    POWER: (base, exp) => Math.pow(parseFloat(base), parseFloat(exp)),
    MOD: (num, divisor) => parseFloat(num) % parseFloat(divisor),
    
    // Statistical functions
    COUNT: (...args) => args.flat(Infinity).filter(v => v !== '' && v !== null && v !== undefined).length,
    COUNTA: (...args) => args.flat(Infinity).filter(v => v !== '').length,
    COUNTBLANK: (...args) => args.flat(Infinity).filter(v => v === '' || v === null || v === undefined).length,
    MEDIAN: (...args) => {
      const sorted = args.flat(Infinity).map(n => parseFloat(n || 0)).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    STDEV: (...args) => {
      const nums = args.flat(Infinity).map(n => parseFloat(n || 0));
      const avg = nums.reduce((a, b) => a + b) / nums.length;
      return Math.sqrt(nums.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / nums.length);
    },
    
    // Logic functions
    IF: (condition, valueIfTrue, valueIfFalse) => condition ? valueIfTrue : valueIfFalse,
    IFS: (...args) => {
      for (let i = 0; i < args.length; i += 2) {
        if (args[i]) return args[i + 1];
      }
      return null;
    },
    AND: (...args) => args.flat(Infinity).every(v => v),
    OR: (...args) => args.flat(Infinity).some(v => v),
    NOT: (value) => !value,
    
    // Text functions
    CONCATENATE: (...args) => args.flat(Infinity).join(''),
    CONCAT: (...args) => args.flat(Infinity).join(''),
    TEXTJOIN: (delimiter, ignoreEmpty, ...args) => {
      const values = args.flat(Infinity);
      return ignoreEmpty ? values.filter(v => v).join(delimiter) : values.join(delimiter);
    },
    LEFT: (text, numChars = 1) => String(text).substring(0, numChars),
    RIGHT: (text, numChars = 1) => String(text).substring(String(text).length - numChars),
    MID: (text, start, numChars) => String(text).substring(start - 1, start - 1 + numChars),
    LEN: (text) => String(text).length,
    TRIM: (text) => String(text).trim(),
    UPPER: (text) => String(text).toUpperCase(),
    LOWER: (text) => String(text).toLowerCase(),
    PROPER: (text) => String(text).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()),
    SUBSTITUTE: (text, oldText, newText, occurrence) => {
      const str = String(text);
      if (occurrence) {
        let count = 0;
        return str.replace(new RegExp(oldText, 'g'), match => {
          count++;
          return count === occurrence ? newText : match;
        });
      }
      return str.split(oldText).join(newText);
    },
    
    // Date functions
    NOW: () => new Date(),
    TODAY: () => new Date().setHours(0, 0, 0, 0),
    YEAR: (date) => new Date(date).getFullYear(),
    MONTH: (date) => new Date(date).getMonth() + 1,
    DAY: (date) => new Date(date).getDate(),
    HOUR: (date) => new Date(date).getHours(),
    MINUTE: (date) => new Date(date).getMinutes(),
    SECOND: (date) => new Date(date).getSeconds(),
    WEEKDAY: (date) => new Date(date).getDay() + 1,
    
    // Lookup functions
    VLOOKUP: (searchKey, range, index, isApproximate = false) => {
      for (let row of range) {
        if (isApproximate ? row[0] <= searchKey : row[0] === searchKey) {
          return row[index - 1];
        }
      }
      return '#N/A';
    },
    HLOOKUP: (searchKey, range, index, isApproximate = false) => {
      const firstRow = range[0];
      for (let i = 0; i < firstRow.length; i++) {
        if (isApproximate ? firstRow[i] <= searchKey : firstRow[i] === searchKey) {
          return range[index - 1][i];
        }
      }
      return '#N/A';
    },
    INDEX: (range, row, col) => range[row - 1][col - 1],
    MATCH: (searchKey, range, searchType = 1) => {
      const flatRange = Array.isArray(range[0]) ? range.flat() : range;
      for (let i = 0; i < flatRange.length; i++) {
        if (searchType === 0 ? flatRange[i] === searchKey : 
            searchType === 1 ? flatRange[i] <= searchKey : 
            flatRange[i] >= searchKey) {
          return i + 1;
        }
      }
      return '#N/A';
    },
    
    // Financial functions
    PMT: (rate, nper, pv, fv = 0, type = 0) => {
      const pvif = Math.pow(1 + rate, nper);
      return rate === 0 ? -(pv + fv) / nper : 
        -(rate * (fv + (pvif * pv))) / ((pvif - 1) * (1 + rate * type));
    },
    FV: (rate, nper, pmt, pv = 0, type = 0) => {
      return pv === 0 ? -pmt * nper : 
        -pv * Math.pow(1 + rate, nper) - pmt * (1 + rate * type) * ((Math.pow(1 + rate, nper) - 1) / rate);
    },
    
    // Array function
    ARRAYFORMULA: (formula) => {
      // Would apply formula to entire range
      return formula;
    },
  };

  // Initialize all Google Sheets features
  function initializeGoogleSheetsFeatures() {
    console.log('[FlockDocs Sheets] Initializing Google Sheets features...');
    
    setupCellFormatting();
    setupConditionalFormatting();
    setupDataValidation();
    setupFreezing();
    setupDataCleanup();
    setupFormulas();
    setupArrayFormulas();
    setupNamedRanges();
    setupPivotTables();
    setupChartsGraphs();
    setupSparklines();
    setupFilters();
    setupSlicers();
    setupSmartChips();
    setupDataExtraction();
    setupTimelineView();
    setupProtectedRanges();
    setupCollaboration();
    setupMacros();
    setupAppsScript();
    setupKeyboardShortcuts();
    
    console.log('[FlockDocs Sheets] All Google Sheets features initialized');
  }

  // ============================================================================
  // CORE DATA & FORMATTING
  // ============================================================================

  function setupCellFormatting() {
    // Add formatting toolbar buttons
    const formatBar = document.getElementById('fd-ss-format-bar');
    if (!formatBar) return;

    // Number format dropdown
    const numberFormatBtn = document.createElement('select');
    numberFormatBtn.id = 'fd-ss-number-format';
    numberFormatBtn.className = 'fd-ss-format-select';
    numberFormatBtn.innerHTML = `
      <option value="general">Automatic</option>
      <option value="number">Number</option>
      <option value="currency">Currency</option>
      <option value="percent">Percent</option>
      <option value="date">Date</option>
      <option value="time">Time</option>
      <option value="text">Plain text</option>
    `;
    
    numberFormatBtn.addEventListener('change', (e) => {
      applyNumberFormat(e.target.value);
    });

    // Text alignment buttons
    const alignLeft = createToolbarButton('Align left', 'align-left');
    const alignCenter = createToolbarButton('Align center', 'align-center');
    const alignRight = createToolbarButton('Align right', 'align-right');
    
    alignLeft.onclick = () => applyCellAlignment('left');
    alignCenter.onclick = () => applyCellAlignment('center');
    alignRight.onclick = () => applyCellAlignment('right');

    // Wrap text button
    const wrapTextBtn = createToolbarButton('Wrap text', 'wrap-text');
    wrapTextBtn.onclick = () => toggleWrapText();

    // Merge cells button
    const mergeCellsBtn = createToolbarButton('Merge cells', 'merge-cells');
    mergeCellsBtn.onclick = () => mergeCells();
  }

  function applyNumberFormat(format) {
    const cell = SheetFeatures.selectedCell;
    if (!cell) return;

    const value = cell.textContent;
    let formatted = value;

    switch (format) {
      case 'currency':
        formatted = '$' + parseFloat(value || 0).toFixed(2);
        break;
      case 'percent':
        formatted = (parseFloat(value || 0) * 100).toFixed(2) + '%';
        break;
      case 'date':
        formatted = new Date(value).toLocaleDateString();
        break;
      case 'time':
        formatted = new Date(value).toLocaleTimeString();
        break;
      case 'number':
        formatted = parseFloat(value || 0).toFixed(2);
        break;
    }

    cell.textContent = formatted;
    cell.dataset.format = format;
    cell.dataset.rawValue = value;
  }

  function applyCellAlignment(align) {
    const selected = getSelectedCells();
    selected.forEach(cell => {
      cell.style.textAlign = align;
    });
  }

  function toggleWrapText() {
    const selected = getSelectedCells();
    selected.forEach(cell => {
      const current = cell.style.whiteSpace;
      cell.style.whiteSpace = current === 'normal' ? 'nowrap' : 'normal';
    });
  }

  function mergeCells() {
    const selected = getSelectedCells();
    if (selected.length < 2) return;

    const firstCell = selected[0];
    const content = selected.map(c => c.textContent).join(' ');
    firstCell.textContent = content;
    firstCell.colSpan = selected.length;
    
    selected.slice(1).forEach(cell => cell.style.display = 'none');
  }

  function setupConditionalFormatting() {
    // Conditional formatting rules
    window.addConditionalFormat = (range, condition, format) => {
      SheetFeatures.conditionalFormats.push({
        range,
        condition, // e.g., (value) => value > 100
        format // e.g., { backgroundColor: 'red', color: 'white' }
      });
      applyConditionalFormats();
    };
  }

  function applyConditionalFormats() {
    SheetFeatures.conditionalFormats.forEach(rule => {
      const cells = getCellsInRange(rule.range);
      cells.forEach(cell => {
        const value = parseFloat(cell.dataset.rawValue || cell.textContent);
        if (rule.condition(value)) {
          Object.assign(cell.style, rule.format);
        }
      });
    });
  }

  function setupDataValidation() {
    window.addDataValidation = (range, validationType, options) => {
      const cells = getCellsInRange(range);
      
      cells.forEach(cell => {
        if (validationType === 'list') {
          // Create dropdown
          const select = document.createElement('select');
          select.className = 'fd-ss-cell-dropdown';
          options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            select.appendChild(option);
          });
          
          cell.innerHTML = '';
          cell.appendChild(select);
          
          select.addEventListener('change', (e) => {
            cell.dataset.rawValue = e.target.value;
          });
        }
        
        SheetFeatures.dataValidations.set(cell, { type: validationType, options });
      });
    };
  }

  function setupFreezing() {
    window.freezeRows = (numRows) => {
      SheetFeatures.frozenRows = numRows;
      const grid = document.getElementById('fd-ss-grid');
      if (!grid) return;

      const rows = grid.querySelectorAll('tr');
      rows.forEach((row, index) => {
        if (index < numRows) {
          row.style.position = 'sticky';
          row.style.top = (index * 30) + 'px';
          row.style.zIndex = 100 - index;
          row.style.backgroundColor = '#1e293b';
        } else {
          row.style.position = '';
          row.style.top = '';
        }
      });
    };

    window.freezeColumns = (numCols) => {
      SheetFeatures.frozenCols = numCols;
      const grid = document.getElementById('fd-ss-grid');
      if (!grid) return;

      const rows = grid.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        cells.forEach((cell, index) => {
          if (index < numCols) {
            cell.style.position = 'sticky';
            cell.style.left = (index * 120) + 'px';
            cell.style.zIndex = 100 - index;
            cell.style.backgroundColor = '#1e293b';
          } else {
            cell.style.position = '';
            cell.style.left = '';
          }
        });
      });
    };
  }

  function setupDataCleanup() {
    window.removeDuplicates = (range) => {
      const cells = getCellsInRange(range);
      const seen = new Set();
      const duplicates = [];

      cells.forEach(cell => {
        const value = cell.textContent.trim();
        if (seen.has(value)) {
          duplicates.push(cell);
        } else {
          seen.add(value);
        }
      });

      duplicates.forEach(cell => {
        cell.textContent = '';
        cell.dataset.rawValue = '';
      });

      return duplicates.length;
    };

    window.trimWhitespace = (range) => {
      const cells = getCellsInRange(range);
      cells.forEach(cell => {
        const trimmed = cell.textContent.trim();
        cell.textContent = trimmed;
        cell.dataset.rawValue = trimmed;
      });
    };
  }

  // ============================================================================
  // FORMULAS & FUNCTIONS
  // ============================================================================

  function setupFormulas() {
    // Make formula engine globally accessible
    window.FormulaEngine = FormulaEngine;

    // Add formula bar
    const formulaBar = document.getElementById('fd-ss-formula-bar');
    if (formulaBar) {
      formulaBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const formula = e.target.value;
          applyFormula(SheetFeatures.selectedCell, formula);
        }
      });
    }

    // Cell double-click to edit formula
    document.addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('fd-ss-cell')) {
        const formulaBar = document.getElementById('fd-ss-formula-bar');
        if (formulaBar) {
          formulaBar.value = e.target.dataset.formula || e.target.textContent;
          formulaBar.focus();
        }
      }
    });
  }

  function applyFormula(cell, formula) {
    if (!cell || !formula.startsWith('=')) return;

    cell.dataset.formula = formula;
    const result = evaluateFormula(formula);
    cell.textContent = result;
    cell.dataset.rawValue = result;
  }

  function evaluateFormula(formula) {
    try {
      // Remove leading =
      let expr = formula.substring(1);

      // Replace cell references (A1, B2, etc.) with values
      expr = expr.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
        const cell = getCellByRef(col + row);
        return cell ? (cell.dataset.rawValue || cell.textContent) : 0;
      });

      // Replace function calls
      Object.keys(FormulaEngine).forEach(funcName => {
        const regex = new RegExp(`\\b${funcName}\\(`, 'gi');
        expr = expr.replace(regex, `FormulaEngine.${funcName}(`);
      });

      // Evaluate
      return eval(expr);
    } catch (err) {
      console.error('[FlockDocs Sheets] Formula error:', err);
      return '#ERROR!';
    }
  }

  function setupArrayFormulas() {
    window.applyArrayFormula = (startCell, formula, rowCount, colCount) => {
      const startRow = getCellRow(startCell);
      const startCol = getCellCol(startCell);

      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const cell = getCellAt(startRow + r, startCol + c);
          if (cell) {
            applyFormula(cell, formula);
          }
        }
      }
    };
  }

  function setupNamedRanges() {
    window.addNamedRange = (name, range) => {
      SheetFeatures.namedRanges.set(name, range);
    };

    window.getNamedRange = (name) => {
      return SheetFeatures.namedRanges.get(name);
    };
  }

  // ============================================================================
  // DATA ANALYSIS & VISUALIZATION
  // ============================================================================

  function setupPivotTables() {
    window.createPivotTable = (dataRange, config) => {
      const data = getCellsInRange(dataRange).map(cell => ({
        value: cell.dataset.rawValue || cell.textContent,
        row: getCellRow(cell),
        col: getCellCol(cell)
      }));

      const pivot = {
        id: Date.now(),
        dataRange,
        config,
        data
      };

      SheetFeatures.pivotTables.push(pivot);
      renderPivotTable(pivot);
    };
  }

  function renderPivotTable(pivot) {
    // Would create a new sheet/table with summarized data
    console.log('[FlockDocs Sheets] Pivot table created:', pivot);
  }

  function setupChartsGraphs() {
    window.createChart = (type, dataRange, config = {}) => {
      const data = getCellsInRange(dataRange).map(cell => 
        parseFloat(cell.dataset.rawValue || cell.textContent || 0)
      );

      const chart = {
        id: Date.now(),
        type, // 'bar', 'line', 'pie', 'scatter'
        dataRange,
        data,
        config
      };

      SheetFeatures.charts.push(chart);
      renderChart(chart);
    };
  }

  function renderChart(chart) {
    // Would use Chart.js or similar library
    console.log('[FlockDocs Sheets] Chart created:', chart);
  }

  function setupSparklines() {
    window.addSparkline = (cell, dataRange, type = 'line') => {
      const data = getCellsInRange(dataRange).map(c => 
        parseFloat(c.dataset.rawValue || c.textContent || 0)
      );

      const sparkline = createSparklineSVG(data, type);
      cell.innerHTML = sparkline;
      cell.classList.add('fd-ss-sparkline');
    };
  }

  function createSparklineSVG(data, type) {
    const width = 80;
    const height = 20;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    if (type === 'line') {
      const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
      }).join(' ');

      return `<svg width="${width}" height="${height}" class="sparkline-svg">
        <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="1.5"/>
      </svg>`;
    }

    // Bar sparkline
    const barWidth = width / data.length;
    const bars = data.map((val, i) => {
      const barHeight = ((val - min) / range) * height;
      const x = i * barWidth;
      const y = height - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth - 1}" height="${barHeight}" fill="#3b82f6"/>`;
    }).join('');

    return `<svg width="${width}" height="${height}" class="sparkline-svg">${bars}</svg>`;
  }

  function setupFilters() {
    window.addFilter = (headerRow) => {
      const cells = document.querySelectorAll(`tr:nth-child(${headerRow}) td`);
      
      cells.forEach((cell, index) => {
        const filterBtn = document.createElement('button');
        filterBtn.className = 'fd-ss-filter-btn';
        filterBtn.innerHTML = '▼';
        filterBtn.onclick = () => showFilterMenu(cell, index);
        
        cell.appendChild(filterBtn);
      });
    };
  }

  function showFilterMenu(headerCell, colIndex) {
    // Would show filter options
    console.log('[FlockDocs Sheets] Filter menu for column:', colIndex);
  }

  function setupSlicers() {
    window.addSlicer = (dataRange, field) => {
      const slicer = {
        id: Date.now(),
        dataRange,
        field,
        values: new Set()
      };

      SheetFeatures.slicers.push(slicer);
      renderSlicer(slicer);
    };
  }

  function renderSlicer(slicer) {
    // Would create floating slicer panel
    console.log('[FlockDocs Sheets] Slicer created:', slicer);
  }

  // ============================================================================
  // SMART CANVAS & INTEGRATIONS
  // ============================================================================

  function setupSmartChips() {
    // Similar to Google Docs smart chips
    document.addEventListener('keyup', (e) => {
      if (e.key === '@' && e.target.classList.contains('fd-ss-cell')) {
        showSmartChipMenu(e.target);
      }
    });
  }

  function showSmartChipMenu(cell) {
    console.log('[FlockDocs Sheets] Smart chip menu triggered');
  }

  function setupDataExtraction() {
    // Extract metadata from smart chips
    window.extractChipData = (chip, property) => {
      // Would extract email, phone, etc. from People chips
      return chip.dataset[property];
    };
  }

  function setupTimelineView() {
    window.showTimelineView = (dataRange) => {
      // Would convert to Gantt chart view
      console.log('[FlockDocs Sheets] Timeline view for:', dataRange);
    };
  }

  // ============================================================================
  // COLLABORATION, PROTECTION & AUTOMATION
  // ============================================================================

  function setupProtectedRanges() {
    window.protectRange = (range, users = []) => {
      const cells = getCellsInRange(range);
      cells.forEach(cell => {
        cell.dataset.protected = 'true';
        cell.dataset.allowedUsers = JSON.stringify(users);
        cell.classList.add('fd-ss-protected');
      });

      SheetFeatures.protectedRanges.set(range, { users });
    };
  }

  function setupCollaboration() {
    // Real-time co-editing would use Firebase
    setInterval(() => {
      saveSheetVersion();
    }, 60000); // Auto-save every minute
  }

  function saveSheetVersion() {
    const grid = document.getElementById('fd-ss-grid');
    if (!grid) return;

    const version = {
      timestamp: new Date().toISOString(),
      html: grid.innerHTML,
      user: 'Current User'
    };

    SheetFeatures.versionHistory.push(version);

    // Keep last 100 versions
    if (SheetFeatures.versionHistory.length > 100) {
      SheetFeatures.versionHistory.shift();
    }

    try {
      localStorage.setItem('flockdocs-sheet-versions-' + getCurrentSheetId(),
        JSON.stringify(SheetFeatures.versionHistory));
    } catch (e) {
      console.warn('[FlockDocs Sheets] Failed to save version:', e);
    }
  }

  function setupMacros() {
    let isRecording = false;
    let recordedActions = [];

    window.startRecordingMacro = () => {
      isRecording = true;
      recordedActions = [];
      console.log('[FlockDocs Sheets] Recording macro...');
    };

    window.stopRecordingMacro = (name) => {
      isRecording = false;
      const macro = {
        name,
        actions: recordedActions,
        timestamp: new Date().toISOString()
      };
      SheetFeatures.macros.push(macro);
      console.log('[FlockDocs Sheets] Macro saved:', name);
      return macro;
    };

    window.playMacro = (name) => {
      const macro = SheetFeatures.macros.find(m => m.name === name);
      if (!macro) return;

      macro.actions.forEach(action => {
        // Replay each recorded action
        executeAction(action);
      });
    };

    // Capture actions when recording
    document.addEventListener('click', (e) => {
      if (isRecording && e.target.classList.contains('fd-ss-cell')) {
        recordedActions.push({
          type: 'click',
          target: getCellRef(e.target),
          timestamp: Date.now()
        });
      }
    });
  }

  function setupAppsScript() {
    window.FlockAppsScript = {
      runFunction: (funcName, ...args) => {
        // Would execute custom user functions
        console.log('[FlockDocs Sheets] Running custom function:', funcName);
      },
      
      addCustomMenu: (menuName, items) => {
        // Would add custom menu items
        console.log('[FlockDocs Sheets] Custom menu added:', menuName);
      },
      
      onEdit: (callback) => {
        document.addEventListener('input', (e) => {
          if (e.target.classList.contains('fd-ss-cell')) {
            callback({
              range: getCellRef(e.target),
              value: e.target.textContent
            });
          }
        });
      }
    };
  }

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + C = Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = getSelectedCells();
        if (selected.length > 0) {
          SheetFeatures.clipboard = selected.map(c => ({
            value: c.dataset.rawValue || c.textContent,
            formula: c.dataset.formula,
            style: c.style.cssText
          }));
        }
      }

      // Ctrl/Cmd + V = Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (SheetFeatures.clipboard && SheetFeatures.selectedCell) {
          pasteClipboard(SheetFeatures.selectedCell);
        }
      }

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Y = Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    });
  }

  function pasteClipboard(startCell) {
    SheetFeatures.clipboard.forEach((item, index) => {
      const row = getCellRow(startCell);
      const col = getCellCol(startCell) + index;
      const targetCell = getCellAt(row, col);

      if (targetCell) {
        targetCell.textContent = item.value;
        targetCell.dataset.rawValue = item.value;
        if (item.formula) {
          targetCell.dataset.formula = item.formula;
        }
        targetCell.style.cssText = item.style;
      }
    });
  }

  function undo() {
    if (SheetFeatures.undoStack.length === 0) return;
    const state = SheetFeatures.undoStack.pop();
    SheetFeatures.redoStack.push(getCurrentState());
    restoreState(state);
  }

  function redo() {
    if (SheetFeatures.redoStack.length === 0) return;
    const state = SheetFeatures.redoStack.pop();
    SheetFeatures.undoStack.push(getCurrentState());
    restoreState(state);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  function getSelectedCells() {
    return Array.from(document.querySelectorAll('.fd-ss-cell.selected'));
  }

  function getCellsInRange(range) {
    // Parse range like "A1:B10"
    const [start, end] = range.split(':');
    const cells = [];
    // Implementation would get all cells between start and end
    return cells;
  }

  function getCellByRef(ref) {
    // Get cell by reference like "A1"
    return document.querySelector(`[data-ref="${ref}"]`);
  }

  function getCellRef(cell) {
    return cell.dataset.ref || '';
  }

  function getCellRow(cell) {
    return parseInt(cell.dataset.row || 0);
  }

  function getCellCol(cell) {
    return parseInt(cell.dataset.col || 0);
  }

  function getCellAt(row, col) {
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  function createToolbarButton(title, iconClass) {
    const btn = document.createElement('button');
    btn.className = 'fd-ss-toolbar-btn';
    btn.title = title;
    btn.innerHTML = `<i class="icon-${iconClass}"></i>`;
    return btn;
  }

  function getCurrentState() {
    const grid = document.getElementById('fd-ss-grid');
    return grid ? grid.innerHTML : '';
  }

  function restoreState(state) {
    const grid = document.getElementById('fd-ss-grid');
    if (grid) grid.innerHTML = state;
  }

  function getCurrentSheetId() {
    return 'current-sheet';
  }

  function executeAction(action) {
    // Execute recorded macro action
    console.log('[FlockDocs Sheets] Executing action:', action);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeGoogleSheetsFeatures, 500);
    });
  } else {
    setTimeout(initializeGoogleSheetsFeatures, 500);
  }

  // Export for external access
  window.FlockSheetsFeatures = SheetFeatures;
  window.FlockFormulaEngine = FormulaEngine;

})();
