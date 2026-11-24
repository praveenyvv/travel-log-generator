// CFR Travel Expense Assistant - Client Logic (with in-place editing & ExcelJS export)

(function () {
  'use strict';

  const STORAGE_KEY = 'cfr_voucher_state_v2';

  const defaultLocations = [
    'Machavaram',
    'Machavaram (home)',
    'Kasukarru',
    'Ponnur',
    'Ponnur bus station',
    'Guntur Bus Station',
    'Tobacco Board HeadQuarters ( APF Ongole-20)',
    'Machavaram Railway Station',
    'Vijayawada Railway Station',
    'Vijayawada BUS Station',
    'JangareddyGudem Bus Station',
    'JangareddyGudem Tobacco Board ( APF JangareddyGudem -32)',
    'Appikatla Bus Station',
    'Mulukuduru X road'
  ];

  let state = {
    employeeName: 'Sai Krishna Meesala',
    reportingManager: 'Kedar Narvekar',
    customerName: 'NOVAMESH, COFORGE',
    monthOfExpenses: '2026-10-10',
    bikeRate: 4.0,
    carRate: 10.0,
    activeDayIndex: 0,
    days: [
      {
        date: '2026-10-09',
        sheetName: '09-10-2026',
        advances: 0,
        legs: [] // internally maintained as legs/logs for backward compatibility
      }
    ]
  };

  let activeMode = 'bike';
  let editingLogIndex = -1; // -1 means adding new log; >= 0 means editing existing log

  // DOM Elements
  const empNameInput = document.getElementById('emp-name');
  const mgrNameInput = document.getElementById('mgr-name');
  const custNameInput = document.getElementById('customer-name');
  const monthInput = document.getElementById('month-expenses');
  const bikeRateInput = document.getElementById('bike-rate');
  const carRateInput = document.getElementById('car-rate');
  const profileCard = document.getElementById('profile-card');
  const profileHeaderClick = document.getElementById('profile-header-click');

  const daysTabsContainer = document.getElementById('days-tabs-container');
  const btnAddDay = document.getElementById('btn-add-day');
  const activeDayDateInput = document.getElementById('active-day-date');
  const activeDaySheetNameInput = document.getElementById('active-day-sheetname');
  const btnDeleteDay = document.getElementById('btn-delete-day');

  const entryCard = document.getElementById('entry-card');
  const entryCardTitle = document.getElementById('entry-card-title');
  const logCounterBadge = document.getElementById('log-counter-badge');
  const logFromInput = document.getElementById('log-from');
  const logToInput = document.getElementById('log-to');
  const btnSwapLocations = document.getElementById('btn-swap-locations');
  const locationsDataList = document.getElementById('locations-list');

  const modePills = document.querySelectorAll('.mode-pill');
  const kmGroup = document.getElementById('km-group');
  const logKmInput = document.getElementById('log-km');
  const calcBadge = document.getElementById('calc-badge');
  const calcPreview = document.getElementById('calc-preview');
  const logAmountInput = document.getElementById('log-amount');
  const logPurposeInput = document.getElementById('log-purpose');
  const purposeChips = document.querySelectorAll('.chip');
  const btnSubmitLog = document.getElementById('btn-submit-log');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');

  const btnQuickFood = document.getElementById('btn-quick-food');
  const btnReverseTrip = document.getElementById('btn-reverse-trip');
  const logsTimeline = document.getElementById('logs-timeline');
  const dayLogsCount = document.getElementById('day-logs-count');
  const daySubtotalVal = document.getElementById('day-subtotal-val');
  const dayAdvancesInput = document.getElementById('day-advances');
  const dayReimbursementVal = document.getElementById('day-reimbursement-val');
  const grandTotalVal = document.getElementById('grand-total-val');

  const btnExportExcel = document.getElementById('btn-export-excel');
  const btnModalExport = document.getElementById('btn-modal-export');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const btnPreviewToggle = document.getElementById('btn-preview-toggle');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const previewModal = document.getElementById('preview-modal');
  const previewSheetSelect = document.getElementById('preview-sheet-select');
  const excelPreviewTableContainer = document.getElementById('excel-preview-table-container');
  const toast = document.getElementById('toast');

  // Persistence
  function loadSavedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('cfr_voucher_state_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load state:', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  function showToast(message, duration = 2500) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // Init
  function init() {
    loadSavedState();
    syncProfileUI();
    updateLocationsDataList();
    renderDayTabs();
    syncActiveDayUI();
    updateModeUI('bike');
    attachEventListeners();
  }

  function syncProfileUI() {
    empNameInput.value = state.employeeName || '';
    mgrNameInput.value = state.reportingManager || '';
    custNameInput.value = state.customerName || '';
    monthInput.value = state.monthOfExpenses || '';
    bikeRateInput.value = state.bikeRate || 4.0;
    carRateInput.value = state.carRate || 10.0;
  }

  function updateLocationsDataList() {
    const locSet = new Set(defaultLocations);
    state.days.forEach(d => {
      (d.legs || []).forEach(l => {
        if (l.from) locSet.add(l.from.trim());
        if (l.to) locSet.add(l.to.trim());
      });
    });

    locationsDataList.innerHTML = '';
    locSet.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      locationsDataList.appendChild(opt);
    });
  }

  function getActiveDay() {
    if (state.activeDayIndex < 0 || state.activeDayIndex >= state.days.length) {
      state.activeDayIndex = 0;
    }
    return state.days[state.activeDayIndex];
  }

  function renderDayTabs() {
    daysTabsContainer.innerHTML = '';
    state.days.forEach((day, idx) => {
      const logs = day.legs || [];
      const dayTotal = logs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      const tab = document.createElement('div');
      tab.className = `day-tab ${idx === state.activeDayIndex ? 'active' : ''}`;
      tab.innerHTML = `
        <span class="day-tab-title">${day.sheetName || day.date}</span>
        <span class="day-tab-sub">₹${dayTotal.toLocaleString('en-IN')} (${logs.length})</span>
      `;
      tab.addEventListener('click', () => {
        if (editingLogIndex !== -1) {
          cancelEdit();
        }
        state.activeDayIndex = idx;
        renderDayTabs();
        syncActiveDayUI();
      });
      daysTabsContainer.appendChild(tab);
    });

    updateGrandTotal();
  }

  function syncActiveDayUI() {
    const day = getActiveDay();
    if (!day) return;

    activeDayDateInput.value = day.date || '';
    activeDaySheetNameInput.value = day.sheetName || '';
    dayAdvancesInput.value = day.advances || 0;

    renderLogsTimeline();
    updateDayCalculations();
  }

  function updateDayCalculations() {
    const day = getActiveDay();
    if (!day) return;

    const logs = day.legs || [];
    const subtotal = logs.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const advances = Number(dayAdvancesInput.value) || 0;
    day.advances = advances;
    const net = Math.max(0, subtotal - advances);

    daySubtotalVal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    dayReimbursementVal.textContent = `₹${net.toLocaleString('en-IN')}`;
    dayLogsCount.textContent = `${logs.length} ${logs.length === 1 ? 'log' : 'logs'}`;

    if (editingLogIndex === -1) {
      logCounterBadge.textContent = `Log #${logs.length + 1}`;
      logCounterBadge.className = 'badge badge-info';
    }

    saveState();
    updateGrandTotal();
  }

  function updateGrandTotal() {
    let grand = 0;
    state.days.forEach(d => {
      const logs = d.legs || [];
      const sub = logs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const adv = Number(d.advances) || 0;
      grand += Math.max(0, sub - adv);
    });
    grandTotalVal.textContent = `₹${grand.toLocaleString('en-IN')}`;
  }

  // Travel Mode Handler
  function updateModeUI(mode) {
    activeMode = mode;
    modePills.forEach(pill => {
      if (pill.dataset.mode === mode) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    if (mode === 'bike' || mode === 'car') {
      kmGroup.style.display = 'flex';
      calcBadge.style.display = 'inline-block';
      recalcKmCost();
    } else {
      kmGroup.style.display = 'none';
      calcBadge.style.display = 'none';
    }

    if (mode === 'food') {
      logFromInput.value = 'FOOD -BreakFast,LUNCH,DINNER';
      logToInput.value = 'FOOD Allowances';
      logPurposeInput.value = 'FOOD Allowance';
      logAmountInput.value = '600';
    }
  }

  function recalcKmCost() {
    const km = parseFloat(logKmInput.value);
    if (!isNaN(km) && km > 0) {
      const rate = activeMode === 'bike' ? (parseFloat(state.bikeRate) || 4.0) : (parseFloat(state.carRate) || 10.0);
      const total = Math.round(km * rate);
      logAmountInput.value = total;
      calcPreview.textContent = `${km} km × ₹${rate} = ₹${total}`;
      calcBadge.style.display = 'inline-block';
    } else {
      calcBadge.style.display = 'none';
    }
  }

  const modeIcons = {
    bike: '🏍️',
    auto: '🛺',
    bus: '🚌',
    train: '🚆',
    hamali: '📦',
    food: '🍽️',
    taxi: '🚕',
    car: '🚗',
    lodging: '🏨',
    flight: '✈️',
    other: '🏷️'
  };

  // Render Logs List with Edit & Delete actions
  function renderLogsTimeline() {
    const day = getActiveDay();
    logsTimeline.innerHTML = '';

    if (!day || !day.legs || day.legs.length === 0) {
      logsTimeline.innerHTML = `
        <div style="text-align: center; padding: 24px 10px; color: var(--text-light); font-size: 0.85rem;">
          No travel logs added for this day yet.<br>Use the form above to quickly log your travel!
        </div>
      `;
      return;
    }

    day.legs.forEach((log, idx) => {
      const card = document.createElement('div');
      card.className = `leg-card ${idx === editingLogIndex ? 'active-editing' : ''}`;

      const icon = modeIcons[log.mode] || '🏷️';
      const kmText = log.km ? `<span class="leg-mode-tag">(${log.km} KM)</span>` : '';

      card.innerHTML = `
        <span class="leg-index">${idx + 1}</span>
        <div class="leg-route">
          <div class="leg-route-main">
            <span>${icon}</span>
            <span>${log.from || '---'}</span>
            <span class="route-arrow">➔</span>
            <span>${log.to || '---'}</span>
          </div>
          <div class="leg-purpose">${log.purpose || 'Travel expense'}</div>
        </div>
        <div class="leg-cost-col">
          <span class="leg-amount">₹${Number(log.amount || 0).toLocaleString('en-IN')}</span>
          <span class="leg-mode-tag">${log.mode.toUpperCase()} ${kmText}</span>
        </div>
        <div class="log-actions">
          <button type="button" class="btn-edit-log" title="Edit this log" data-index="${idx}">
            ✏️ Edit
          </button>
          <button type="button" class="btn-del-leg" title="Delete log" data-index="${idx}">
            ✕
          </button>
        </div>
      `;

      card.querySelector('.btn-edit-log').addEventListener('click', (e) => {
        e.stopPropagation();
        startEditingLog(idx);
      });

      card.querySelector('.btn-del-leg').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLog(idx);
      });

      logsTimeline.appendChild(card);
    });
  }

  // Edit Log Mode
  function startEditingLog(index) {
    const day = getActiveDay();
    if (!day || !day.legs[index]) return;

    editingLogIndex = index;
    const log = day.legs[index];

    // Populate form with existing values
    logFromInput.value = log.from || '';
    logToInput.value = log.to || '';
    logPurposeInput.value = log.purpose || '';
    logAmountInput.value = log.amount !== undefined ? log.amount : '';
    logKmInput.value = log.km || '';

    updateModeUI(log.mode || 'bike');
    if (log.km) {
      recalcKmCost();
    }

    // Switch UI to edit mode
    entryCard.classList.add('is-editing');
    entryCardTitle.textContent = `Edit Travel Log #${index + 1}`;
    logCounterBadge.textContent = `Editing #${index + 1}`;
    logCounterBadge.className = 'badge badge-warning';

    btnSubmitLog.innerHTML = `<span>💾</span> Save Changes to Log #${index + 1}`;
    btnSubmitLog.className = 'btn btn-success btn-lg';
    btnCancelEdit.classList.remove('hidden');

    renderLogsTimeline();
    entryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast(`Editing Log #${index + 1}`);
  }

  function cancelEdit() {
    editingLogIndex = -1;
    entryCard.classList.remove('is-editing');
    entryCardTitle.textContent = 'Add Travel Log';
    btnSubmitLog.innerHTML = '<span>+</span> Add Travel Log';
    btnSubmitLog.className = 'btn btn-primary btn-block btn-lg';
    btnCancelEdit.classList.add('hidden');

    // Clear form
    logFromInput.value = '';
    logToInput.value = '';
    logKmInput.value = '';
    logAmountInput.value = '';
    logPurposeInput.value = '';

    renderLogsTimeline();
    updateDayCalculations();
  }

  function submitLog() {
    const day = getActiveDay();
    if (!day) return;

    const fromVal = logFromInput.value.trim();
    const toVal = logToInput.value.trim();
    const purposeVal = logPurposeInput.value.trim();
    const amountVal = parseFloat(logAmountInput.value);
    const kmVal = logKmInput.value ? parseFloat(logKmInput.value) : null;

    if (!fromVal && !toVal && isNaN(amountVal)) {
      showToast('⚠️ Please enter travel route or amount');
      return;
    }

    const logData = {
      from: fromVal,
      to: toVal,
      purpose: purposeVal || `${activeMode.toUpperCase()} Travel`,
      mode: activeMode,
      km: kmVal,
      amount: !isNaN(amountVal) ? amountVal : 0
    };

    if (editingLogIndex >= 0) {
      // Update existing log
      day.legs[editingLogIndex] = logData;
      showToast(`✓ Log #${editingLogIndex + 1} updated`);
      cancelEdit();
    } else {
      // Add new log
      day.legs.push(logData);
      showToast(`✓ Log #${day.legs.length} added`);

      // Chain: keep 'To' as next default 'From'
      logFromInput.value = toVal;
      logToInput.value = '';
      logKmInput.value = '';
      logAmountInput.value = '';
      logPurposeInput.value = '';
    }

    updateLocationsDataList();
    renderDayTabs();
    renderLogsTimeline();
    updateDayCalculations();
  }

  function deleteLog(index) {
    const day = getActiveDay();
    if (!day) return;

    if (editingLogIndex === index) {
      cancelEdit();
    } else if (editingLogIndex > index) {
      editingLogIndex--;
    }

    day.legs.splice(index, 1);
    renderDayTabs();
    renderLogsTimeline();
    updateDayCalculations();
    showToast('Log removed');
  }

  // Quick Actions
  function addQuickFood() {
    const day = getActiveDay();
    if (!day) return;

    const hasFood = (day.legs || []).some(l => l.mode === 'food');
    if (hasFood) {
      if (!confirm('A food allowance is already added for this day. Add another?')) {
        return;
      }
    }

    day.legs.push({
      from: 'FOOD -BreakFast,LUNCH,DINNER',
      to: 'FOOD Allowances',
      purpose: 'FOOD Allowance',
      mode: 'food',
      km: null,
      amount: 600
    });

    renderDayTabs();
    renderLogsTimeline();
    updateDayCalculations();
    showToast('✓ Added ₹600 Food Allowance');
  }

  function reverseLastTrip() {
    const day = getActiveDay();
    if (!day || !day.legs || day.legs.length === 0) {
      showToast('No previous log to reverse');
      return;
    }

    const last = day.legs[day.legs.length - 1];
    logFromInput.value = last.to;
    logToInput.value = last.from;
    logPurposeInput.value = `Return to ${last.from}`;
    updateModeUI(last.mode);
    if (last.km) {
      logKmInput.value = last.km;
      recalcKmCost();
    } else {
      logAmountInput.value = last.amount;
    }

    showToast('Reversed previous route! Tap Add Travel Log when ready.');
  }

  // Excel Preview Modal
  function openExcelPreview() {
    previewSheetSelect.innerHTML = '';
    state.days.forEach((day, idx) => {
      const logs = day.legs || [];
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Sheet: ${day.sheetName || day.date} (₹${logs.reduce((s, l) => s + (Number(l.amount) || 0), 0)})`;
      previewSheetSelect.appendChild(opt);
    });

    previewSheetSelect.value = state.activeDayIndex;
    renderExcelPreviewSheet(state.activeDayIndex);
    previewModal.classList.remove('hidden');
  }

  function renderExcelPreviewSheet(dayIdx) {
    const day = state.days[dayIdx];
    if (!day) return;

    let totalSub = 0;
    const logs = day.legs || [];
    const rowsHtml = logs.map((log, i) => {
      const amt = Number(log.amount) || 0;
      totalSub += amt;

      const isBike = log.mode === 'bike';
      const isCar = log.mode === 'car';
      const isBus = log.mode === 'bus';
      const isAuto = log.mode === 'auto';
      const isTrain = log.mode === 'train';
      const isFoodHamali = ['food', 'hamali', 'other', 'others'].includes(log.mode);
      const isLodging = log.mode === 'lodging';
      const isFlight = log.mode === 'flight';
      const isTaxi = log.mode === 'taxi';

      return `
        <tr>
          <td>${i + 1}</td>
          <td>${day.date}</td>
          <td class="text-left">${state.customerName || 'NOVAMESH, COFORGE'}</td>
          <td class="text-left">${log.from || ''}</td>
          <td class="text-left">${log.to || ''}</td>
          <td>${isBike ? 'Bike' : (isCar ? 'Car' : '')}</td>
          <td>${log.km || ''}</td>
          <td class="text-left">${log.purpose || ''}</td>
          <td>${isLodging ? amt : ''}</td>
          <td>${isFlight ? amt : ''}</td>
          <td>${isBus ? amt : ''}</td>
          <td>${isAuto ? amt : ''}</td>
          <td>${isTaxi ? amt : ''}</td>
          <td>${isBike ? amt : ''}</td>
          <td>${isCar ? amt : ''}</td>
          <td>${isTrain ? amt : ''}</td>
          <td colspan="3">${isFoodHamali ? amt : ''}</td>
          <td class="font-mono text-right row-total">${amt}</td>
        </tr>
      `;
    }).join('');

    const advances = Number(day.advances) || 0;
    const net = Math.max(0, totalSub - advances);

    const html = `
      <table class="excel-table">
        <tr>
          <td colspan="5" class="text-left" style="font-size: 1.1rem; font-weight: bold; border: none;">Expense Report</td>
          <td colspan="15" style="border: none;"></td>
        </tr>
        <tr>
          <td colspan="2" class="text-left"><strong>Employee Name:</strong></td>
          <td colspan="3" class="text-left">${state.employeeName}</td>
          <td colspan="15" style="border: none;"></td>
        </tr>
        <tr>
          <td colspan="2" class="text-left"><strong>Reporting Manager:</strong></td>
          <td colspan="3" class="text-left">${state.reportingManager}</td>
          <td colspan="15" style="border: none;"></td>
        </tr>
        <tr>
          <td colspan="2" class="text-left"><strong>Month of Expenses:</strong></td>
          <td colspan="3" class="text-left">${state.monthOfExpenses}</td>
          <td colspan="15" style="border: none;"></td>
        </tr>
        <tr style="height: 10px; border: none;"><td colspan="20" style="border: none;"></td></tr>
        
        <tr class="th-header">
          <th rowspan="2">Sr. No</th>
          <th rowspan="2">DATE</th>
          <th rowspan="2">Customer Name</th>
          <th rowspan="2">From</th>
          <th rowspan="2">To</th>
          <th colspan="2">Total KM For Car/Bike</th>
          <th rowspan="2">Purpose of Travel / Issue Description</th>
          <th rowspan="2">Lodging</th>
          <th colspan="7">Transportation</th>
          <th rowspan="2" colspan="3">Food Allowances / HAMALI</th>
          <th rowspan="2">TOTAL</th>
        </tr>
        <tr class="th-header">
          <th>Car/Bike</th>
          <th>KM</th>
          <th>Flight</th>
          <th>Bus</th>
          <th>Auto</th>
          <th>Taxi</th>
          <th>Bike</th>
          <th>Car</th>
          <th>Train</th>
        </tr>

        ${rowsHtml || '<tr><td colspan="20" style="padding: 16px; color: #888;">No logs in this sheet yet</td></tr>'}

        <tr style="height: 12px; border: none;"><td colspan="20" style="border: none;"></td></tr>
        
        <tr>
          <td colspan="16" style="border: none;"></td>
          <td colspan="3" class="text-left"><strong>SUBTOTAL</strong></td>
          <td class="font-mono text-right row-total"><strong>${totalSub}</strong></td>
        </tr>
        <tr>
          <td colspan="16" style="border: none;"></td>
          <td colspan="3" class="text-left"><strong>ADVANCES</strong></td>
          <td class="font-mono text-right row-total">${advances}</td>
        </tr>
        <tr>
          <td colspan="16" style="border: none;"></td>
          <td colspan="3" class="text-left"><strong>TOTAL REIMBURSEMENT</strong></td>
          <td class="font-mono text-right row-total" style="background: #c6efce; color: #006100; font-size: 0.95rem;"><strong>${net}</strong></td>
        </tr>
        <tr>
          <td colspan="16" style="border: none;"></td>
          <td colspan="4" class="text-left" style="font-size: 0.72rem; font-style: italic;">* Don't forget to attach receipts *</td>
        </tr>
        
        <tr style="height: 20px; border: none;"><td colspan="20" style="border: none;"></td></tr>
        
        <tr>
          <td colspan="6" class="text-left"><strong>Re Checked By:</strong></td>
          <td colspan="4">Date:</td>
          <td colspan="6" class="text-left"><strong>Authorized By:</strong></td>
          <td colspan="4">Date:</td>
        </tr>
        <tr>
          <td colspan="10" class="sign-box" style="height: 50px;">Finance</td>
          <td colspan="10" class="sign-box" style="height: 50px;">For Office Use Only</td>
        </tr>
        <tr>
          <td colspan="10" style="border: none;"></td>
          <td colspan="6" class="text-left"><strong>Final Approval By:</strong></td>
          <td colspan="4">Date:</td>
        </tr>
      </table>
    `;

    excelPreviewTableContainer.innerHTML = html;
  }

  // Excel Export: supports both Backend API and In-Browser ExcelJS
  async function exportExcel() {
    showToast('⏳ Generating company voucher Excel...');

    // First try backend /api/export if available
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });

      if (response.ok) {
        const blob = await response.blob();
        downloadBlob(blob);
        showToast('🎉 Excel downloaded via backend engine!');
        return;
      }
    } catch (e) {
      console.log('Backend export unavailable, generating via in-browser ExcelJS engine...');
    }

    // Direct in-browser Excel generation via ExcelJS (works on Vercel & offline!)
    try {
      if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS library not loaded');
      }
      await generateExcelWithExcelJS();
      showToast('🎉 Excel downloaded successfully!');
    } catch (err) {
      console.error('Export error:', err);
      showToast('❌ Failed to download Excel: ' + err.message);
    }
  }

  async function generateExcelWithExcelJS() {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'CFR Travel Voucher';

    const emp = state.employeeName || 'Sai Krishna Meesala';
    const mgr = state.reportingManager || 'Kedar Narvekar';
    const cust = state.customerName || 'NOVAMESH, COFORGE';
    const month = state.monthOfExpenses || '2026-10-10';

    const solidFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D9D9D9' }
    };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'A0A0A0' } },
      left: { style: 'thin', color: { argb: 'A0A0A0' } },
      bottom: { style: 'thin', color: { argb: 'A0A0A0' } },
      right: { style: 'thin', color: { argb: 'A0A0A0' } }
    };
    const centerAlign = { vertical: 'middle', horizontal: 'center' };

    state.days.forEach((day, dayIdx) => {
      const sheetTitle = (day.sheetName || day.date || `Day ${dayIdx + 1}`).replace(/[\/\\:?*\[\]]/g, '-').slice(0, 31);
      const ws = wb.addWorksheet(sheetTitle);

      // Set column widths matching original
      ws.columns = [
        { key: 'A', width: 4 },
        { key: 'B', width: 8 },
        { key: 'C', width: 14 },
        { key: 'D', width: 22 },
        { key: 'E', width: 36 },
        { key: 'F', width: 36 },
        { key: 'G', width: 14 },
        { key: 'H', width: 10 },
        { key: 'I', width: 45 },
        { key: 'J', width: 10 },
        { key: 'K', width: 10 },
        { key: 'L', width: 10 },
        { key: 'M', width: 10 },
        { key: 'N', width: 10 },
        { key: 'O', width: 10 },
        { key: 'P', width: 10 },
        { key: 'Q', width: 12 },
        { key: 'R', width: 10 },
        { key: 'S', width: 10 },
        { key: 'T', width: 10 },
        { key: 'U', width: 12 }
      ];

      // Top block
      ws.getCell('C2').value = 'Expense Report';
      ws.getCell('C2').font = { bold: true, size: 14 };
      ws.mergeCells('C2:G2');

      ws.getCell('C3').value = 'Employee Name';
      ws.getCell('C3').font = { bold: true };
      ws.mergeCells('C3:D3');
      ws.getCell('E3').value = emp;
      ws.mergeCells('E3:G3');

      ws.getCell('C4').value = 'Reporting Manager';
      ws.getCell('C4').font = { bold: true };
      ws.mergeCells('C4:D4');
      ws.getCell('E4').value = mgr;
      ws.mergeCells('E4:G4');

      ws.getCell('C5').value = 'Month of Expenses';
      ws.getCell('C5').font = { bold: true };
      ws.mergeCells('C5:D5');
      ws.getCell('E5').value = month;
      ws.mergeCells('E5:G5');

      // Header row 7
      const h7 = {
        B: 'Sr. No', C: 'DATE\nDD-MM-YYYY', D: 'Customer Name', E: 'From', F: 'To',
        G: 'Total KM For Car/Bike', I: 'Purpose of Travel /\nIssue Description',
        J: 'Lodging', K: 'Transportation', R: 'Food Allownaces/others', U: 'TOTAL'
      };
      Object.keys(h7).forEach(col => {
        const cell = ws.getCell(`${col}7`);
        cell.value = h7[col];
        cell.font = { bold: true };
        cell.fill = solidFill;
        cell.alignment = centerAlign;
        cell.border = thinBorder;
      });

      // Header row 8
      const h8 = {
        G: 'Car/Bike', H: 'KM', K: 'Flight', L: 'Bus', M: 'Auto', N: 'Taxi', O: 'Bike', P: 'Car', Q: 'Train'
      };
      Object.keys(h8).forEach(col => {
        const cell = ws.getCell(`${col}8`);
        cell.value = h8[col];
        cell.font = { bold: true };
        cell.fill = solidFill;
        cell.alignment = centerAlign;
        cell.border = thinBorder;
      });

      // Header Merges
      ['B7:B8', 'C7:C8', 'D7:D8', 'E7:E8', 'F7:F8', 'G7:H7', 'I7:I8', 'J7:J8', 'K7:Q7', 'R7:T8', 'U7:U8'].forEach(m => {
        try { ws.mergeCells(m); } catch (e) {}
      });

      // Data rows starting from Row 9
      const logs = day.legs || [];
      let currRow = 9;
      let daySubtotal = 0;

      logs.forEach((log, idx) => {
        const r = currRow;
        const amt = Number(log.amount) || 0;
        daySubtotal += amt;

        ws.getCell(`B${r}`).value = idx + 1;
        ws.getCell(`C${r}`).value = day.date;
        ws.getCell(`D${r}`).value = cust;
        ws.getCell(`E${r}`).value = log.from || '';
        ws.getCell(`F${r}`).value = log.to || '';
        ws.getCell(`I${r}`).value = log.purpose || '';

        const mode = (log.mode || '').toLowerCase();
        if (mode === 'bike') {
          ws.getCell(`G${r}`).value = 'Bike';
          if (log.km) ws.getCell(`H${r}`).value = Number(log.km);
          ws.getCell(`O${r}`).value = amt;
        } else if (mode === 'car') {
          ws.getCell(`G${r}`).value = 'Car';
          if (log.km) ws.getCell(`H${r}`).value = Number(log.km);
          ws.getCell(`P${r}`).value = amt;
        } else if (mode === 'bus') {
          ws.getCell(`L${r}`).value = amt;
        } else if (mode === 'auto') {
          ws.getCell(`M${r}`).value = amt;
        } else if (mode === 'train') {
          ws.getCell(`Q${r}`).value = amt;
        } else if (mode === 'flight') {
          ws.getCell(`K${r}`).value = amt;
        } else if (mode === 'taxi') {
          ws.getCell(`N${r}`).value = amt;
        } else if (mode === 'lodging') {
          ws.getCell(`J${r}`).value = amt;
        } else {
          ws.getCell(`R${r}`).value = amt;
        }

        ws.mergeCells(`R${r}:T${r}`);
        ws.getCell(`U${r}`).value = amt;

        // Apply borders & alignment
        for (let colCode = 66; colCode <= 85; colCode++) { // B to U
          const colLtr = String.fromCharCode(colCode);
          const cell = ws.getCell(`${colLtr}${r}`);
          cell.border = thinBorder;
          if (['D', 'E', 'F', 'I'].includes(colLtr)) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else {
            cell.alignment = centerAlign;
          }
        }

        currRow++;
      });

      currRow += 2; // Spacing

      // Subtotal
      ws.getCell(`Q${currRow}`).value = 'SUBTOTAL';
      ws.getCell(`Q${currRow}`).font = { bold: true };
      ws.mergeCells(`Q${currRow}:T${currRow}`);
      ws.getCell(`U${currRow}`).value = daySubtotal;
      ws.getCell(`U${currRow}`).font = { bold: true };
      ws.getCell(`U${currRow}`).fill = solidFill;
      ws.getCell(`U${currRow}`).alignment = centerAlign;
      ws.getCell(`U${currRow}`).border = thinBorder;
      currRow++;

      // Advances
      const adv = Number(day.advances) || 0;
      ws.getCell(`Q${currRow}`).value = 'ADVANCES';
      ws.getCell(`Q${currRow}`).font = { bold: true };
      ws.mergeCells(`Q${currRow}:T${currRow}`);
      ws.getCell(`U${currRow}`).value = adv;
      ws.getCell(`U${currRow}`).fill = solidFill;
      ws.getCell(`U${currRow}`).alignment = centerAlign;
      ws.getCell(`U${currRow}`).border = thinBorder;
      currRow++;

      // Total Reimbursement
      const netClaim = Math.max(0, daySubtotal - adv);
      ws.getCell(`Q${currRow}`).value = 'TOTAL REIMBURSEMENT';
      ws.getCell(`Q${currRow}`).font = { bold: true };
      ws.mergeCells(`Q${currRow}:T${currRow}`);
      ws.getCell(`U${currRow}`).value = netClaim;
      ws.getCell(`U${currRow}`).font = { bold: true };
      ws.getCell(`U${currRow}`).fill = solidFill;
      ws.getCell(`U${currRow}`).alignment = centerAlign;
      ws.getCell(`U${currRow}`).border = thinBorder;
      currRow++;

      // Receipt warning
      ws.getCell(`Q${currRow}`).value = "* Don't forget to attach receipts *";
      ws.getCell(`Q${currRow}`).font = { italic: true, bold: true, size: 10 };
      ws.mergeCells(`Q${currRow}:U${currRow}`);
      currRow += 3;

      // Approval blocks
      ws.getCell(`C${currRow}`).value = 'Re Checked By';
      ws.getCell(`C${currRow}`).font = { bold: true };
      ws.mergeCells(`C${currRow}:J${currRow}`);
      ws.getCell(`K${currRow}`).value = 'Date';
      ws.getCell(`Q${currRow}`).value = 'Authorized By';
      ws.getCell(`Q${currRow}`).font = { bold: true };
      ws.mergeCells(`Q${currRow}:T${currRow}`);
      ws.getCell(`U${currRow}`).value = 'Date';
      currRow += 3;

      ws.getCell(`C${currRow}`).value = 'Finance';
      ws.getCell(`C${currRow}`).font = { bold: true };
      ws.getCell(`C${currRow}`).fill = solidFill;
      ws.mergeCells(`C${currRow}:L${currRow + 3}`);
      ws.getCell(`Q${currRow}`).value = 'For Office Use Only ';
      ws.getCell(`Q${currRow}`).fill = solidFill;
      ws.mergeCells(`Q${currRow}:U${currRow + 3}`);
      currRow += 6;

      ws.getCell(`Q${currRow}`).value = 'Final Approval By';
      ws.getCell(`Q${currRow}`).font = { bold: true };
      ws.mergeCells(`Q${currRow}:T${currRow}`);
      ws.getCell(`U${currRow}`).value = 'Date';
      currRow += 3;

      ws.getCell(`Q${currRow}`).value = 'For Office Use Only ';
      ws.getCell(`Q${currRow}`).fill = solidFill;
      ws.mergeCells(`Q${currRow}:U${currRow + 3}`);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob);
  }

  function downloadBlob(blob) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const emp = (state.employeeName || 'Employee').replace(/\s+/g, '_');
    const month = (state.monthOfExpenses || 'Expenses').replace(/-/g, '_');
    a.download = `Travel_Voucher_${emp}_${month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  // Load Reference Sample Data
  async function loadSampleData() {
    if (!confirm('Load reference sample data from October 9 & 10? This will replace current draft.')) {
      return;
    }

    try {
      showToast('Loading sample data...');
      const res = await fetch('/api/sample');
      let sample;
      if (res.ok) {
        sample = await res.json();
      } else {
        // Fallback embedded sample if backend not running
        sample = {
          employeeName: 'Sai Krishna Meesala',
          reportingManager: 'Kedar Narvekar',
          customerName: 'NOVAMESH, COFORGE',
          monthOfExpenses: '2026-10-10',
          bikeRate: 4.0,
          carRate: 10.0,
          days: [
            {
              date: '2026-10-09',
              sheetName: '09-10-2026',
              advances: 0,
              legs: [
                { from: 'Machavaram', to: 'Kasukarru', purpose: 'to Collect material From HUB', mode: 'bike', km: 10, amount: 40 },
                { from: 'kasukarru', to: 'Machavaram (home)', purpose: 'after maeterial collect to home and check contents', mode: 'bike', km: 10, amount: 40 },
                { from: 'Machavaram (home)', to: 'Ponnur', purpose: 'going to guntur with material Box Chassis', mode: 'bike', km: 8, amount: 32 },
                { from: 'Ponnur bus station', to: 'Guntur Bus Station', purpose: 'going to guntur from ponnur with material Box Chassis', mode: 'bus', km: null, amount: 30 },
                { from: 'Guntur Bus Station', to: 'Tobacco Board HeadQuarters ( APF Ongole-20)', purpose: 'going to guntur Tobacco Board head Office with material Box Chassis', mode: 'auto', km: null, amount: 100 },
                { from: 'Tobacco Board HeadQuarters ( APF Ongole-20)', to: 'Guntur Bus Station', purpose: 'Chassis replacement complete going to Guntur Bus station', mode: 'auto', km: null, amount: 130 },
                { from: 'Guntur Bus Station', to: 'Ponnur bus station', purpose: 'Going to hometown bus', mode: 'bus', km: null, amount: 30 },
                { from: 'Ponnur bus station', to: 'Machavaram', purpose: 'Going to home by auto', mode: 'auto', km: null, amount: 80 },
                { from: 'FOOD -BreakFast,LUNCH,DINNER', to: 'FOOD Allowances', purpose: 'FOOD Allowance', mode: 'food', km: null, amount: 600 }
              ]
            },
            {
              date: '2026-10-10',
              sheetName: '10-10-2026',
              advances: 0,
              legs: [
                { from: 'Machavaram Railway Station', to: 'Vijayawada Railway Station', purpose: 'Went to Collect material From HUB', mode: 'train', km: null, amount: 20 },
                { from: 'Vijayawada Railway Station Hamali pickup Package', to: 'Shimpment package to Vijayawada Railway Station SouthGate Exit', purpose: 'after maeterial collect to home and check contents', mode: 'hamali', km: null, amount: 150 },
                { from: 'Vijayawada Railway Station', to: 'Vijayawada BUS Station', purpose: 'going to Vijayawada with material Box Chassis', mode: 'auto', km: null, amount: 250 },
                { from: 'Vijayawada BUS Station Entrance gate Hamali', to: 'Vijayawada BUS Station PLATFORM 15 (JangareddyGudem Bus arrival Point)', purpose: 'Going to Vijayawada bus station with material Box Chassis', mode: 'hamali', km: null, amount: 100 },
                { from: 'Vijayawada BUS Station', to: 'JangareddyGudem Bus Station', purpose: 'Going to jangareddyGudem bus station with material Box Chassis', mode: 'bus', km: null, amount: 200 },
                { from: 'JangareddyGudem Bus Station', to: 'JangareddyGudem Tobacco Board ( APF JangareddyGudem -32)', purpose: 'way to Tobacco board in auto', mode: 'auto', km: null, amount: 150 },
                { from: 'JangareddyGudem Tobacco Board', to: 'JangareddyGudem Bus Station', purpose: 'Return To Bus station after work Finish', mode: 'auto', km: null, amount: 150 },
                { from: 'JangareddyGudem Bus Station', to: 'Vijayawada BUS Station', purpose: 'back Vijayawada BUS Station', mode: 'bus', km: null, amount: 200 },
                { from: 'Vijayawada BUS Station', to: 'Appikatla Bus Station', purpose: 'back Appikatla Bus Station', mode: 'bus', km: null, amount: 135 },
                { from: 'Appikatla Bus Station', to: 'Mulukuduru X road', purpose: 'Mulukuduru X roads (Cash Payment)', mode: 'auto', km: null, amount: 200 },
                { from: 'Mulukuduru X road', to: 'Machavaram (Home)', purpose: 'reached Home (Cash Payment)', mode: 'auto', km: null, amount: 150 },
                { from: 'FOOD -BreakFast,LUNCH,DINNER', to: 'FOOD Allowances', purpose: 'Food Allowances', mode: 'food', km: null, amount: 600 }
              ]
            }
          ]
        };
      }

      state = { ...state, ...sample, activeDayIndex: 0 };
      saveState();
      syncProfileUI();
      updateLocationsDataList();
      renderDayTabs();
      syncActiveDayUI();
      showToast('✓ Sample data loaded (2 days, 21 logs)');
    } catch (e) {
      console.error(e);
      showToast('Could not load sample data');
    }
  }

  // Event Listeners
  function attachEventListeners() {
    [empNameInput, mgrNameInput, custNameInput, monthInput, bikeRateInput, carRateInput].forEach(inp => {
      inp.addEventListener('input', () => {
        state.employeeName = empNameInput.value;
        state.reportingManager = mgrNameInput.value;
        state.customerName = custNameInput.value;
        state.monthOfExpenses = monthInput.value;
        state.bikeRate = parseFloat(bikeRateInput.value) || 4.0;
        state.carRate = parseFloat(carRateInput.value) || 10.0;
        saveState();
        if (activeMode === 'bike' || activeMode === 'car') {
          recalcKmCost();
        }
      });
    });

    profileHeaderClick.addEventListener('click', () => {
      profileCard.classList.toggle('collapsed');
    });

    btnSettingsToggle.addEventListener('click', () => {
      profileCard.classList.toggle('collapsed');
      if (!profileCard.classList.contains('collapsed')) {
        profileCard.scrollIntoView({ behavior: 'smooth' });
      }
    });

    modePills.forEach(pill => {
      pill.addEventListener('click', () => {
        updateModeUI(pill.dataset.mode);
      });
    });

    logKmInput.addEventListener('input', recalcKmCost);

    btnSwapLocations.addEventListener('click', () => {
      const tmp = logFromInput.value;
      logFromInput.value = logToInput.value;
      logToInput.value = tmp;
    });

    purposeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        logPurposeInput.value = chip.textContent;
      });
    });

    btnSubmitLog.addEventListener('click', submitLog);
    btnCancelEdit.addEventListener('click', cancelEdit);

    btnQuickFood.addEventListener('click', addQuickFood);
    btnReverseTrip.addEventListener('click', reverseLastTrip);

    activeDayDateInput.addEventListener('change', () => {
      const day = getActiveDay();
      if (!day) return;
      day.date = activeDayDateInput.value;
      if (day.date.includes('-')) {
        const parts = day.date.split('-');
        day.sheetName = `${parts[2]}-${parts[1]}-${parts[0]}`;
        activeDaySheetNameInput.value = day.sheetName;
      }
      renderDayTabs();
      saveState();
    });

    activeDaySheetNameInput.addEventListener('input', () => {
      const day = getActiveDay();
      if (!day) return;
      day.sheetName = activeDaySheetNameInput.value;
      renderDayTabs();
      saveState();
    });

    dayAdvancesInput.addEventListener('input', updateDayCalculations);

    btnAddDay.addEventListener('click', () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const parts = dateStr.split('-');
      const sheetStr = `${parts[2]}-${parts[1]}-${parts[0]}`;

      state.days.push({
        date: dateStr,
        sheetName: sheetStr,
        advances: 0,
        legs: []
      });
      state.activeDayIndex = state.days.length - 1;
      renderDayTabs();
      syncActiveDayUI();
      showToast('✓ New day added');
    });

    btnDeleteDay.addEventListener('click', () => {
      if (state.days.length <= 1) {
        showToast('At least one day is required');
        return;
      }
      if (confirm(`Delete day tab "${getActiveDay().sheetName}"?`)) {
        state.days.splice(state.activeDayIndex, 1);
        state.activeDayIndex = Math.max(0, state.activeDayIndex - 1);
        renderDayTabs();
        syncActiveDayUI();
        showToast('Day removed');
      }
    });

    btnLoadSample.addEventListener('click', loadSampleData);
    btnExportExcel.addEventListener('click', exportExcel);
    btnModalExport.addEventListener('click', exportExcel);

    btnPreviewToggle.addEventListener('click', openExcelPreview);
    btnCloseModal.addEventListener('click', () => {
      previewModal.classList.add('hidden');
    });

    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        previewModal.classList.add('hidden');
      }
    });

    previewSheetSelect.addEventListener('change', () => {
      renderExcelPreviewSheet(parseInt(previewSheetSelect.value, 10));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
