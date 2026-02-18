(function () {
  'use strict';

  function showCompatBanner() {
    var el = document.getElementById('compatBanner');
    if (el) el.hidden = false;
  }

  function runApp() {
    var form = document.getElementById('auditForm');
    if (!form) {
      showCompatBanner();
      return;
    }
    try {
      localStorage.setItem('_t', '1');
      localStorage.removeItem('_t');
    } catch (e) {
      showCompatBanner();
    }

  const STORAGE_KEY = 'itac-energy-audit-form-v1';
  const DEBOUNCE_MS = 600;
  const IDB_NAME = 'EnergyAuditDB';
  const IDB_STORE = 'formData';

  let saveTimeout = null;
  let useIndexedDB = false;

  const saveStatus = document.getElementById('saveStatus');
  const downloadPdfBtn = document.getElementById('downloadPdf');
  const downloadPdfBottom = document.getElementById('downloadPdfBottom');
  const resetFormBtn = document.getElementById('resetForm');
  const lightingBody = document.getElementById('lightingBody');
  const addLightingRowBtn = document.getElementById('addLightingRow');
  const powerMiscBody = document.getElementById('powerMiscBody');
  const addPowerMiscRowBtn = document.getElementById('addPowerMiscRow');

  const TAB_IDS = ['general', 'utility', 'lighting', 'hvac', 'compressed_air', 'boiler', 'envelope', 'power', 'chillers', 'generator'];

  function getTabFromHash() {
    const hash = (location.hash || '').slice(1);
    return TAB_IDS.includes(hash) ? hash : 'general';
  }

  function switchTab(tabId) {
    if (!TAB_IDS.includes(tabId)) tabId = 'general';
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      const isActive = btn.getAttribute('data-tab') === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.form-section.tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.getAttribute('data-section') === tabId);
    });
    location.hash = tabId;
  }

  function initTabs() {
    switchTab(getTabFromHash());
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
    });
    window.addEventListener('hashchange', () => switchTab(getTabFromHash()));
  }

  function idb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  function getFormData() {
    const data = { fields: {}, lightingRows: 1, powerMiscRows: 1, lighting: [], powerMisc: [] };

    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((el) => {
      const name = el.name;
      if (!name) return;
      if (el.type === 'radio') {
        if (el.checked) data.fields[name] = el.value;
      } else {
        data.fields[name] = el.value;
      }
    });

    const lightingRows = lightingBody.querySelectorAll('tr');
    data.lightingRows = lightingRows.length;
    data.lighting = [];
    lightingRows.forEach((row, i) => {
      const rowData = {};
      row.querySelectorAll('input').forEach((inp) => {
        const n = inp.name;
        if (n) rowData[n] = inp.value;
      });
      data.lighting.push(rowData);
    });

    const powerRows = powerMiscBody.querySelectorAll('tr');
    data.powerMiscRows = powerRows.length;
    data.powerMisc = [];
    powerRows.forEach((row) => {
      const rowData = {};
      row.querySelectorAll('input').forEach((inp) => {
        const n = inp.name;
        if (n) rowData[n] = inp.value;
      });
      data.powerMisc.push(rowData);
    });

    return data;
  }

  function setFormData(data) {
    if (!data || !data.fields) return;

    Object.keys(data.fields).forEach((name) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el) return;
      if (el.type === 'radio') {
        const opt = form.querySelector(`[name="${name}"][value="${data.fields[name]}"]`);
        if (opt) opt.checked = true;
      } else {
        el.value = data.fields[name] || '';
      }
    });

    while (lightingBody.rows.length > 1) lightingBody.deleteRow(1);
    if (data.lighting && data.lighting.length > 0) {
      data.lighting.forEach((rowData, i) => {
        if (i === 0) {
          Object.keys(rowData || {}).forEach((name) => {
            const inp = form.querySelector(`[name="${name}"]`);
            if (inp) inp.value = rowData[name] || '';
          });
        } else {
          addLightingRow();
          const row = lightingBody.rows[lightingBody.rows.length - 1];
          (rowData && Object.keys(rowData)).forEach((name) => {
            const inp = row.querySelector(`[name="${name}"]`);
            if (inp) inp.value = rowData[name] || '';
          });
        }
      });
    }

    while (powerMiscBody.rows.length > 1) powerMiscBody.deleteRow(1);
    if (data.powerMisc && data.powerMisc.length > 0) {
      data.powerMisc.forEach((rowData, i) => {
        if (i === 0) {
          Object.keys(rowData || {}).forEach((name) => {
            const inp = form.querySelector(`[name="${name}"]`);
            if (inp) inp.value = rowData[name] || '';
          });
        } else {
          addPowerMiscRow();
          const row = powerMiscBody.rows[powerMiscBody.rows.length - 1];
          (rowData && Object.keys(rowData)).forEach((name) => {
            const inp = row.querySelector(`[name="${name}"]`);
            if (inp) inp.value = rowData[name] || '';
          });
        }
      });
    }
  }

  function showStatus(text, isSaving) {
    saveStatus.textContent = text;
    saveStatus.classList.toggle('saving', !!isSaving);
  }

  function save() {
    const data = getFormData();
    data.savedAt = new Date().toISOString();

    if (useIndexedDB) {
      idb()
        .then((db) => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put({ id: STORAGE_KEY, data: data });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });
        })
        .then(() => {
          showStatus('Saved', false);
        })
        .catch(() => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          showStatus('Saved', false);
        });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        showStatus('Saved', false);
      } catch (e) {
        showStatus('Storage full', false);
      }
    }
  }

  function scheduleSave() {
    showStatus('Saving…', true);
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      save();
      saveTimeout = null;
    }, DEBOUNCE_MS);
  }

  function load() {
    function apply(data) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed && (parsed.fields || parsed.data)) {
          setFormData(parsed.data || parsed);
          showStatus('Resumed', false);
          setTimeout(() => showStatus('Saved', false), 2000);
        }
      } catch (e) {
        console.warn('Load failed', e);
      }
    }

    idb()
      .then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(STORAGE_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      })
      .then((row) => {
        if (row && row.data) {
          useIndexedDB = true;
          apply(row.data);
        } else {
          const local = localStorage.getItem(STORAGE_KEY);
          if (local) apply(local);
        }
      })
      .catch(() => {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) apply(local);
      });
  }

  function addLightingRow() {
    const idx = lightingBody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = `
      <td><input type="text" name="lighting_location_${idx}"></td>
      <td><input type="text" name="lighting_similar_${idx}" placeholder="Y/N"></td>
      <td><input type="text" name="lighting_fixtures_${idx}" inputmode="numeric"></td>
      <td><input type="text" name="lighting_lamps_${idx}" inputmode="numeric"></td>
      <td><input type="text" name="lighting_lamp_type_${idx}"></td>
      <td><input type="text" name="lighting_demand_${idx}" inputmode="decimal"></td>
      <td><input type="text" name="lighting_hours_${idx}"></td>
      <td><input type="text" name="lighting_sensor_${idx}" placeholder="Y/N"></td>
      <td><input type="text" name="lighting_height_${idx}" inputmode="decimal"></td>
      <td><button type="button" class="btn-remove-row" aria-label="Remove row">&times;</button></td>
    `;
    lightingBody.appendChild(tr);
    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      tr.remove();
      scheduleSave();
    });
    tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', scheduleSave));
    scheduleSave();
  }

  function addPowerMiscRow() {
    const idx = powerMiscBody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.className = 'data-row';
    tr.innerHTML = `
      <td><input type="text" name="pwr_cat_${idx}"></td>
      <td><input type="text" name="pwr_loc_${idx}"></td>
      <td><input type="text" name="pwr_brand_${idx}"></td>
      <td><input type="text" name="pwr_age_${idx}" inputmode="numeric"></td>
      <td><input type="text" name="pwr_cap_${idx}"></td>
      <td><input type="text" name="pwr_units_${idx}" inputmode="numeric"></td>
      <td><button type="button" class="btn-remove-row" aria-label="Remove row">&times;</button></td>
    `;
    powerMiscBody.appendChild(tr);
    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      tr.remove();
      scheduleSave();
    });
    tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', scheduleSave));
    scheduleSave();
  }

  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', scheduleSave);
    el.addEventListener('change', scheduleSave);
  });

  lightingBody.querySelectorAll('.btn-remove-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (lightingBody.querySelectorAll('tr').length > 1) row.remove();
      scheduleSave();
    });
  });

  powerMiscBody.querySelectorAll('.btn-remove-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      if (powerMiscBody.querySelectorAll('tr').length > 1) row.remove();
      scheduleSave();
    });
  });

  addLightingRowBtn.addEventListener('click', addLightingRow);
  addPowerMiscRowBtn.addEventListener('click', addPowerMiscRow);

  function resetForm() {
    if (!confirm('Clear all data and start fresh for the next audit? This cannot be undone.')) return;
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    while (lightingBody.rows.length > 1) lightingBody.deleteRow(1);
    while (powerMiscBody.rows.length > 1) powerMiscBody.deleteRow(1);
    TAB_IDS.forEach((sectionId) => {
      const container = form.querySelector('.notes-pages-container[data-section="' + sectionId + '"]');
      if (!container) return;
      const countInput = container.querySelector('input[name="notes_page_count_' + sectionId + '"]');
      if (countInput) countInput.value = '1';
      const pages = container.querySelectorAll('.notes-page');
      for (let i = 1; i < pages.length; i++) pages[i].remove();
    });
    if (useIndexedDB) {
      idb().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).delete(STORAGE_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }).catch(() => {});
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    showStatus('Form reset', false);
    setTimeout(() => showStatus('Saved', false), 2000);
  }

  resetFormBtn.addEventListener('click', resetForm);
  document.getElementById('resetFormBottom').addEventListener('click', resetForm);

  function loadImageAsBase64(url) {
    return fetch(url).then((r) => r.blob()).then((blob) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });
  }

  function buildPdf(data) {
    if (typeof window.jspdf === 'undefined') {
      throw new Error('PDF requires opening in Safari or an HTML Viewer app.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;
    const lineH = 5.2;
    const cellPad = 2;
    const primaryColor = [26, 54, 93];
    const headerBg = [247, 249, 252];
    const borderColor = [200, 210, 220];

    function newPage() {
      doc.addPage();
      y = 14;
    }

    function addLine(text, bold, fontSize) {
      if (y > 276) newPage();
      doc.setFontSize(fontSize || 9);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(String(text || ''), pageW - 2 * margin);
      lines.forEach((line) => {
        doc.text(line, margin, y);
        y += lineH;
      });
    }

    function addSectionTitle(title) {
      if (y > 268) newPage();
      y += 4;
      const titleH = 9;
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(margin, y - 5, pageW - 2 * margin, titleH, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(title, margin + 3, y + 1.5);
      doc.setTextColor(30, 30, 30);
      y += titleH + 4;
      doc.setFont('helvetica', 'normal');
    }

    function addSubTitle(title) {
      if (y > 272) newPage();
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title, margin, y);
      y += lineH + 2;
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'normal');
    }

    function fieldVal(name) {
      const v = (data.fields && data.fields[name]) || '';
      if (v === 'Y') return 'Yes';
      if (v === 'N') return 'No';
      return v;
    }

    function drawTable(headers, rows, getCell) {
      const colCount = headers.length;
      const tableW = pageW - 2 * margin;
      const colW = tableW / colCount;
      const rowH = 6;
      const fontSize = 7;
      doc.setFontSize(fontSize);
      if (y + (rows.length + 1) * rowH > 278) newPage();
      let x = margin;
      // Header row (no fill, just light border and bold text)
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      headers.forEach((h) => {
        doc.rect(x, y, colW, rowH, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        const txt = doc.splitTextToSize(String(h), colW - 2 * cellPad);
        doc.text(txt[0] || '', x + cellPad, y + rowH - 2);
        x += colW;
      });
      y += rowH;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      rows.forEach((row, rowIndex) => {
        x = margin;
        if (y > 276) newPage();
        headers.forEach((_, ci) => {
          doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
          doc.rect(x, y, colW, rowH, 'S');
          const cellText = getCell(row, ci, rowIndex);
          const txt = doc.splitTextToSize(String(cellText || ''), colW - 2 * cellPad);
          doc.text(txt[0] || '', x + cellPad, y + rowH - 2);
          x += colW;
        });
        y += rowH;
      });
      y += 4;
    }

    return { doc, margin, y: () => y, setY: (v) => { y = v; }, addLine, addSectionTitle, addSubTitle, fieldVal, drawTable, newPage, lineH };
  }

  const PDF_LABELS = {
    site_visit_date: 'Site visit date',
    facility_name: 'Name of the facility',
    facility_location: 'Location of the facility',
    facility_area: 'Total facility area (built) – office area',
    contact1_name: 'Contact person name and designation (1)',
    contact1_phone: 'Contact person phone number (1)',
    contact1_email: 'Contact person email (1)',
    contact2_name: 'Contact person name and designation (2)',
    contact2_phone: 'Contact person phone number (2)',
    contact2_email: 'Contact person email (2)',
    num_employees: 'Number of employees',
    production_schedule: 'Production schedule',
    office_schedule: 'Regular office schedule',
    major_products: 'Major products / services',
    annual_sales: 'Annual Sales / gross revenue',
    raw_materials: 'Main raw materials',
    final_wastes: 'Final wastes',
    labor_rates: 'Labor rates for site improvements',
    electricity_supplier: 'Electricity supplier name',
    electricity_kwh_charge: 'Electricity kWh charge',
    electricity_demand_charge: 'Electricity demand charge',
    power_factor: 'Power factor',
    gas_supplier: 'Natural gas supplier name',
    gas_cost: 'Natural gas cost',
    water_supplier: 'Potable water supplier name',
    water_cost: 'Potable water cost',
    fuel_oil_consumption: 'Annual fuel oil consumption',
    solar_pv_capacity: 'Solar PV capacity (if available)',
    renewable_capacity: 'Renewable energy capacity (if available)',
    lighting_location: 'Location / Area of lighting',
    lighting_similar: 'Similar fixture available? (Y/N)',
    lighting_fixtures: 'Number of fixtures',
    lighting_lamps: 'Lamps per fixture',
    lighting_lamp_type: 'Existing lamp type (non-LED)',
    lighting_demand: 'Fixture demand (kW)',
    lighting_hours: 'Daily / weekly operating hours',
    lighting_sensor: 'Occupancy sensor available? (Y/N)',
    lighting_height: 'Mounting height (ft)',
    hvac_system_type: 'HVAC system type',
    hvac_thermostat_count: 'Any Programmable thermostat available? If so, how many?',
    hvac_spt_summer: 'Current Setpoint Temperature (SPT) during summer',
    hvac_spt_winter: 'SPT during winter',
    hvac_sbt_summer: 'Set Back Temperature (SBT) during non-occupied hours / night-time in summer',
    hvac_sbt_winter: 'SBT during winter',
    hvac_destrat_fans: 'Any destratification fans available? How many?',
    hvac_calibration_date: 'Previous date of thermostat calibration?',
    hvac_maintenance_freq: 'How often is the maintenance program?',
    hvac_last_maintenance: 'When did the last maintenance happen?',
    hvac_maintenance_duration: 'Duration of each maintenance per unit?',
    hvac_maintenance_tasks: 'Common tasks during routine maintenance?',
    compressor_count: 'No. of existing compressors',
    com_plans_change: 'Any plans for changing old compressor?',
    com_ventilated: 'Location of compressors well ventilated?',
    com_receiver: 'Primary air receiver tank available? Total storage capacity?',
    com_header_storage: 'Any common header storage available? Capacity of the common storage?',
    com_secondary_storage: 'Any secondary storage system available? Capacity of storage?',
    com_loop_dist: 'Loop distribution system used?',
    com_maintenance_interval: 'What is the maintenance program interval?',
    com_last_leak: 'Last Leak detection program performed?',
    com_maint_activities: 'What are the common activities during compressor maintenance?',
    com_leaks_observed: 'Audible / visible leaks observed?',
    com_leaks_count: 'How many leaks are identified?',
    com_leaks_db: 'What are the dBs of audible leaks?',
    com_leaks_size: 'What are the approximate sizes of leaks?',
    boiler_maint_time: 'Boiler maintenance time',
    boiler_maint_interval: 'Boiler maintenance interval',
    boiler_condensate: 'Condensate recovery system available?',
    boiler_blowdown: 'Automatic blowdown system?',
    boiler_insulation: 'Insulation of the valve and flanges checked?',
    boiler_heat_recovery: 'Any waste heat recovery system installed?',
    env_wall_detail: 'Exterior wall materials of the facility',
    env_insulation_detail: 'Insulation materials in heated/cooled space',
    env_wall_thick_detail: 'Wall insulation thickness',
    env_wall_temp: 'Inside wall surface temperature (using thermal gun)',
    env_roof_area: 'Roof Insulation Area',
    env_roof_materials: 'Roof materials of the manufacturing facility',
    env_roof_temp: 'Roof surface temperature (using thermal gun)',
    env_roof_thick: 'Roof insulation thickness',
    env_insulation_age: 'How old is the insulation system?',
    gen_has_backup: 'Does the site have any backup Generator? (Y/N)',
    chiller_units: 'Number of units',
    chiller_brand: 'Brand / Model',
    chiller_age: 'Estimated age',
    chiller_cap: 'Capacity / Size',
    chiller_temp_in: 'Temp. IN (°F)',
    chiller_temp_out: 'Temp. OUT (°F)',
    chiller_wet_bulb: 'Wet bulb temp (°F)',
    chiller_op_time: 'Existing chiller operation time',
    chiller_efficiency: 'Chiller efficiency'
  };

  function labelFor(name) {
    const base = name.replace(/\d+$/, '').replace(/_(\d+)$/, '');
    return PDF_LABELS[base] || PDF_LABELS[name] || name.replace(/_/g, ' ');
  }

  function hasSectionContent(sectionId, data) {
    const fields = data.fields || {};
    const has = (name) => (fields[name] || '').toString().trim() !== '';
    if (has('notes_extra_' + sectionId)) return true;
    const count = parseInt(fields['notes_page_count_' + sectionId], 10) || 0;
    for (let i = 0; i < count; i++) {
      if (has('notes_page_' + sectionId + '_' + i)) return true;
    }
    const sectionPrefixes = {
      general: ['site_visit_date', 'facility_name', 'facility_location', 'facility_area', 'contact1_', 'contact2_', 'num_employees', 'production_schedule', 'office_schedule', 'major_products', 'annual_sales', 'raw_materials', 'final_wastes', 'labor_rates'],
      utility: ['electricity_', 'gas_supplier', 'gas_cost', 'water_supplier', 'water_cost', 'fuel_oil', 'solar_pv', 'renewable_'],
      lighting: ['lighting_'],
      hvac: ['hvac_'],
      compressed_air: ['compressor_count', 'com_'],
      boiler: ['boiler_'],
      envelope: ['env_'],
      power: ['pwr_'],
      chillers: ['chiller_'],
      generator: ['gen_', 'gpm_o2_', 'aux_co', 'aux_co1_', 'aux_co2_']
    };
    const prefixes = sectionPrefixes[sectionId];
    if (!prefixes) return false;
    for (const key of Object.keys(fields)) {
      const v = (fields[key] || '').toString().trim();
      if (v === '') continue;
      for (const p of prefixes) {
        if (key === p || key.indexOf(p) === 0) return true;
      }
    }
    if (sectionId === 'lighting' && data.lighting && data.lighting.length > 0) {
      const hasRow = data.lighting.some((row) => Object.keys(row).some((k) => (row[k] || '').toString().trim() !== ''));
      if (hasRow) return true;
    }
    if (sectionId === 'power' && data.powerMisc && data.powerMisc.length > 0) {
      const hasRow = data.powerMisc.some((row) => Object.keys(row).some((k) => (row[k] || '').toString().trim() !== ''));
      if (hasRow) return true;
    }
    return false;
  }

  function addSectionNotesToPdf(ctx, sectionId, sectionLabel, data) {
    const { addLine, addSubTitle } = ctx;
    const fields = data.fields || {};
    const val = (name) => (fields[name] || '').toString().trim();
    const extra = val('notes_extra_' + sectionId);
    if (extra) {
      addSubTitle('Extra points / key notes');
      addLine(extra);
    }
    const count = parseInt(fields['notes_page_count_' + sectionId], 10) || 0;
    for (let i = 0; i < count; i++) {
      const pageText = val('notes_page_' + sectionId + '_' + i);
      if (pageText) {
        addSubTitle('Notes page ' + (i + 1));
        addLine(pageText);
      }
    }
  }

  async function buildPdfFull() {
    const data = getFormData();
    const ctx = buildPdf(data);
    const { doc, addLine, addSectionTitle, addSubTitle, fieldVal, drawTable, margin } = ctx;
    let y = 12;

    const img1 = await loadImageAsBase64('image1.png').catch(() => null);
    const img2 = await loadImageAsBase64('image2.png').catch(() => null);
    const imgH = 14;
    const imgW1 = 45;
    const imgW2 = 35;
    if (img1) {
      doc.addImage(img1, 'PNG', 12, y, imgW1, imgH);
    }
    if (img2) {
      doc.addImage(img2, 'PNG', 210 - 12 - imgW2, y, imgW2, imgH);
    }
    y += imgH + 8;
    ctx.setY(y);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 54, 93);
    doc.text('ITAC Energy Audit Form', margin, y);
    y += 7;
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.4);
    doc.line(margin, y, 210 - margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Saved at: ' + (data.savedAt || new Date().toISOString()), margin, y);
    y += 6;
    ctx.setY(y);

    let sectionNum = 0;
    if (hasSectionContent('general', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. General Facility Information');
      const generalFields = ['site_visit_date', 'facility_name', 'facility_location', 'facility_area', 'contact1_name', 'contact1_phone', 'contact1_email', 'contact2_name', 'contact2_phone', 'contact2_email', 'num_employees', 'production_schedule', 'office_schedule', 'major_products', 'annual_sales', 'raw_materials', 'final_wastes', 'labor_rates'];
      generalFields.forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'general', 'General', data);
    }
    if (hasSectionContent('utility', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Utility Consumption');
      const utilityFields = ['electricity_supplier', 'electricity_kwh_charge', 'electricity_demand_charge', 'power_factor', 'gas_supplier', 'gas_cost', 'water_supplier', 'water_cost', 'fuel_oil_consumption', 'solar_pv_capacity', 'renewable_capacity'];
      utilityFields.forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'utility', 'Utility', data);
    }

    if (hasSectionContent('lighting', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Lighting System');
      addSubTitle('Existing Lighting Counts');
      const lightingHeaders = ['Location / Area', 'Similar (Y/N)', 'No. of fixtures', 'Lamps per fixture', 'Lamp type (non-LED)', 'Demand (kW)', 'Daily / weekly hours', 'Occupancy sensor (Y/N)', 'Mounting height (ft)'];
      const lightingCols = ['lighting_location', 'lighting_similar', 'lighting_fixtures', 'lighting_lamps', 'lighting_lamp_type', 'lighting_demand', 'lighting_hours', 'lighting_sensor', 'lighting_height'];
      const lightingRows = (data.lighting && data.lighting.length) ? data.lighting : [{}];
      drawTable(lightingHeaders, lightingRows, (row, ci, rowIndex) => {
        const k = lightingCols[ci] + '_' + rowIndex;
        return row[k] != null ? row[k] : (row[lightingCols[ci]] || '');
      });
      addSectionNotesToPdf(ctx, 'lighting', 'Lighting', data);
    }

    if (hasSectionContent('hvac', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. HVAC System');
      addLine(labelFor('hvac_system_type') + ': ' + fieldVal('hvac_system_type'));
      const hvacHeaders = ['Parameter', 'HVAC-1', 'HVAC-2', 'HVAC-3', 'HVAC-4'];
      const hvacRows = [
        ['S/N of HVAC', 'hvac_sn_1', 'hvac_sn_2', 'hvac_sn_3', 'hvac_sn_4'],
        ['Brand Name', 'hvac_brand_1', 'hvac_brand_2', 'hvac_brand_3', 'hvac_brand_4'],
        ['Model Number', 'hvac_model_1', 'hvac_model_2', 'hvac_model_3', 'hvac_model_4'],
        ['Capacity, Tons / MMBtu', 'hvac_cap_1', 'hvac_cap_2', 'hvac_cap_3', 'hvac_cap_4'],
        ['Operating hours', 'hvac_hours_1', 'hvac_hours_2', 'hvac_hours_3', 'hvac_hours_4'],
        ['Estimated age', 'hvac_age_1', 'hvac_age_2', 'hvac_age_3', 'hvac_age_4'],
        ['Installed location / height of the units', 'hvac_location_1', 'hvac_location_2', 'hvac_location_3', 'hvac_location_4']
      ];
      drawTable(hvacHeaders, hvacRows, (row, ci) => (ci === 0 ? row[0] : fieldVal(row[ci])));
      addSubTitle('General Information about heating/cooling');
      ['hvac_thermostat_count', 'hvac_spt_summer', 'hvac_spt_winter', 'hvac_sbt_summer', 'hvac_sbt_winter', 'hvac_destrat_fans', 'hvac_calibration_date', 'hvac_maintenance_freq', 'hvac_last_maintenance', 'hvac_maintenance_duration', 'hvac_maintenance_tasks'].forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'hvac', 'HVAC', data);
    }

    if (hasSectionContent('compressed_air', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Compressed Air System');
      addLine('Number of existing compressors: ' + fieldVal('compressor_count'));
      const comHeaders = ['Parameters', 'Com-1', 'Com-2', 'Com-3'];
      const comRows = [
        ['Compressor Type – rotary / reciprocating / screw', 'com_type_1', 'com_type_2', 'com_type_3'],
        ['Brand / Model', 'com_brand_1', 'com_brand_2', 'com_brand_3'],
        ['Size of compressors (HP)', 'com_size_1', 'com_size_2', 'com_size_3'],
        ['Daily / Annual operating hours', 'com_hours_1', 'com_hours_2', 'com_hours_3'],
        ['Estimated age', 'com_age_1', 'com_age_2', 'com_age_3'],
        ['Any VFD installed? Specifications (nameplate)', 'com_vfd_1', 'com_vfd_2', 'com_vfd_3'],
        ['Discharge pressure of the compressor (psig)', 'com_discharge_1', 'com_discharge_2', 'com_discharge_3'],
        ['Min pressure required at all other points of use', 'com_min_press_1', 'com_min_press_2', 'com_min_press_3'],
        ['Load / Unload pressure', 'com_load_1', 'com_load_2', 'com_load_3'],
        ['Loading / Unloading time', 'com_load_time_1', 'com_load_time_2', 'com_load_time_3'],
        ['Cooling System – air / water cooled', 'com_cooling_1', 'com_cooling_2', 'com_cooling_3']
      ];
      drawTable(comHeaders, comRows, (row, ci) => (ci === 0 ? row[0] : fieldVal(row[ci])));
      addSubTitle('General Information of usage');
      ['com_plans_change', 'com_ventilated', 'com_receiver', 'com_header_storage', 'com_secondary_storage', 'com_loop_dist', 'com_maintenance_interval', 'com_last_leak', 'com_maint_activities', 'com_leaks_observed', 'com_leaks_count', 'com_leaks_db', 'com_leaks_size'].forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'compressed_air', 'Compressed Air', data);
    }

    if (hasSectionContent('boiler', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Boiler System');
      const boilerHeaders = ['Parameters', 'B-1', 'B-2', 'B-3', 'B-4'];
      const boilerRows = [
        ['Brand', 'boiler_brand_1', 'boiler_brand_2', 'boiler_brand_3', 'boiler_brand_4'],
        ['Model', 'boiler_model_1', 'boiler_model_2', 'boiler_model_3', 'boiler_model_4'],
        ['Capacity of boiler (from nameplate)', 'boiler_cap_1', 'boiler_cap_2', 'boiler_cap_3', 'boiler_cap_4'],
        ['What is fuel type?', 'boiler_fuel_1', 'boiler_fuel_2', 'boiler_fuel_3', 'boiler_fuel_4'],
        ['Daily / Annual operation schedule', 'boiler_schedule_1', 'boiler_schedule_2', 'boiler_schedule_3', 'boiler_schedule_4'],
        ['Estimated boiler load factor', 'boiler_load_1', 'boiler_load_2', 'boiler_load_3', 'boiler_load_4'],
        ['Boiler feed-water temperature', 'boiler_feed_1', 'boiler_feed_2', 'boiler_feed_3', 'boiler_feed_4'],
        ['Combustion air inlet temperature', 'boiler_air_1', 'boiler_air_2', 'boiler_air_3', 'boiler_air_4'],
        ['Operating pressure of the boiler', 'boiler_pressure_1', 'boiler_pressure_2', 'boiler_pressure_3', 'boiler_pressure_4'],
        ['Condensate return temperature', 'boiler_cond_1', 'boiler_cond_2', 'boiler_cond_3', 'boiler_cond_4'],
        ['Make-up water temperature', 'boiler_makeup_1', 'boiler_makeup_2', 'boiler_makeup_3', 'boiler_makeup_4'],
        ['Insulation temperature of the valve and flanges (using thermal gun)', 'boiler_ins_temp_1', 'boiler_ins_temp_2', 'boiler_ins_temp_3', 'boiler_ins_temp_4'],
        ['Flue gas temperature (using flue gas analyzer)', 'boiler_flue_1', 'boiler_flue_2', 'boiler_flue_3', 'boiler_flue_4'],
        ['Oxygen percentage (using flue gas analyzer)', 'boiler_o2_1', 'boiler_o2_2', 'boiler_o2_3', 'boiler_o2_4']
      ];
      drawTable(boilerHeaders, boilerRows, (row, ci) => (ci === 0 ? row[0] : fieldVal(row[ci])));
      addSubTitle('General Information');
      ['boiler_maint_time', 'boiler_maint_interval', 'boiler_condensate', 'boiler_blowdown', 'boiler_insulation', 'boiler_heat_recovery'].forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'boiler', 'Boiler', data);
    }

    if (hasSectionContent('envelope', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Building Envelope System');
      const envChecks = [
        'env_insulation', 'env_wall_thick', 'env_wall_materials', 'env_roof_ins', 'env_roof_thick_yn', 'env_thermal', 'env_uninsulated', 'env_door', 'env_vestibule', 'env_windows', 'env_films', 'env_shading'
      ];
      const envLabels = [
        'Insulation between heated/cooled spaces and unconditioned or outside areas?',
        'Wall insulation thickness known?',
        'Exterior wall materials of the facility identified?',
        'Roof insulation present?',
        'Roof insulation thickness known?',
        'Hot surfaces insulation checked using thermal scanner?',
        'Uninsulated valves/flanges found?',
        'Automatic door closing mechanisms worked?',
        'Vestibule doors at major entrances?',
        'Broken or cracked windows noticed?',
        'Any reflective or heat absorbing films installed?',
        'Outdoor shading devices installed?'
      ];
      envChecks.forEach((n, i) => addLine(envLabels[i] + ': ' + (fieldVal(n) || '') + (fieldVal(n + '_note') ? ' (Note: ' + fieldVal(n + '_note') + ')' : '')));
      addSubTitle('Detailed Information');
      ['env_wall_detail', 'env_insulation_detail', 'env_wall_thick_detail', 'env_wall_temp', 'env_roof_area', 'env_roof_materials', 'env_roof_temp', 'env_roof_thick', 'env_insulation_age'].forEach((n) => addLine(labelFor(n) + ': ' + fieldVal(n)));
      addSectionNotesToPdf(ctx, 'envelope', 'Building Envelope', data);
    }

    if (hasSectionContent('power', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Power System – Energy Assessment Checklist');
      const pwrChecks = [
        'pwr_transformer', 'pwr_trans_no_load', 'pwr_vending', 'pwr_vend_miser', 'pwr_motor_inv', 'pwr_motor_sizes', 'pwr_motor_eff', 'pwr_vfd', 'pwr_pumps', 'pwr_belt_fan', 'pwr_direct_fan', 'pwr_demand', 'pwr_pf', 'pwr_maint_records', 'pwr_forklift'
      ];
      const pwrLabels = [
        'Transformer ambient temperature high?',
        'Transformers remain energized when serving no load for extended periods?',
        'Vending machines remain energized during unoccupied periods?',
        'Any Vend Miser installed?',
        'Motor inventory completed?',
        'Motor sizes recorded?',
        'Motor efficiency class known?',
        'VFDs installed on motors?',
        'Pumps capacity recorded?',
        'Belt-driven fan available?',
        'Direct-driven fan available?',
        'High electricity demand charges incurred?',
        'Low power factor observed in the bill?',
        'Any records of maintenance for motors and motor driven equipment available?',
        'Are forklifts battery powered?'
      ];
      pwrChecks.forEach((n, i) => addLine(pwrLabels[i] + ': ' + (fieldVal(n) || '') + (fieldVal(n + '_note') ? ' (Note: ' + fieldVal(n + '_note') + ')' : '')));
      addSubTitle('Miscellaneous');
      const pwrMiscHeaders = ['Category', 'Location', 'Brand / Model', 'Estimated age (years)', 'Capacity / Size (HP)', 'Number of units'];
      const pwrMiscCols = ['pwr_cat', 'pwr_loc', 'pwr_brand', 'pwr_age', 'pwr_cap', 'pwr_units'];
      const pwrMiscRows = (data.powerMisc && data.powerMisc.length) ? data.powerMisc : [{}];
      drawTable(pwrMiscHeaders, pwrMiscRows, (row, ci, rowIndex) => {
        const k = pwrMiscCols[ci] + '_' + rowIndex;
        return row[k] != null ? row[k] : (row[pwrMiscCols[ci]] || '');
      });
      addSectionNotesToPdf(ctx, 'power', 'Power', data);
    }

    if (hasSectionContent('chillers', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Chillers / Cooling Tower');
      const chillerHeaders = ['Number of units', 'Brand/Model', 'Estimated age', 'Capacity/Size', 'Temp IN (°F)', 'Temp OUT (°F)', 'Wet bulb (°F)'];
      const chillerCells = ['chiller_units', 'chiller_brand', 'chiller_age', 'chiller_cap', 'chiller_temp_in', 'chiller_temp_out', 'chiller_wet_bulb'];
      drawTable(chillerHeaders, [chillerCells.map((c) => fieldVal(c))], (row, ci) => (row[ci] != null ? row[ci] : ''));
      addSubTitle('Detailed Information');
      addLine(labelFor('chiller_op_time') + ': ' + fieldVal('chiller_op_time'));
      addLine(labelFor('chiller_efficiency') + ': ' + fieldVal('chiller_efficiency'));
      addSectionNotesToPdf(ctx, 'chillers', 'Chillers', data);
    }

    if (hasSectionContent('generator', data)) {
      sectionNum++;
      addSectionTitle(sectionNum + '. Generator');
      addLine('Does the site have any backup Generator? (Y/N): ' + fieldVal('gen_has_backup'));
      addSubTitle('Generator');
      const genHeaders = ['Parameters', 'Gen-1', 'Gen-2', 'Gen-3', 'Gen-4'];
      const genRows = [
        ['Brand', 'gen_brand_1', 'gen_brand_2', 'gen_brand_3', 'gen_brand_4'],
        ['Model', 'gen_model_1', 'gen_model_2', 'gen_model_3', 'gen_model_4'],
        ['Type of fuel used (N.G. / Diesel / Others)', 'gen_fuel_1', 'gen_fuel_2', 'gen_fuel_3', 'gen_fuel_4'],
        ['Capacity, KW/HP', 'gen_cap_1', 'gen_cap_2', 'gen_cap_3', 'gen_cap_4'],
        ['Running Load, KW/HP', 'gen_load_1', 'gen_load_2', 'gen_load_3', 'gen_load_4'],
        ['Jacket water inlet temp. °F', 'gen_jw_in_1', 'gen_jw_in_2', 'gen_jw_in_3', 'gen_jw_in_4'],
        ['Jacket water outlet temp. °F', 'gen_jw_out_1', 'gen_jw_out_2', 'gen_jw_out_3', 'gen_jw_out_4'],
        ['Jacket water flowrate, gpm', 'gpm_o2_1', 'gpm_o2_2', 'gpm_o2_3', 'gpm_o2_4'],
        ['Auxiliary cooling water inlet temp. °F', 'aux_co_1', 'aux_co_2', 'aux_co_3', 'aux_co_4'],
        ['Auxiliary cooling water outlet temp. °F', 'aux_co1_1', 'aux_co1_2', 'aux_co1_3', 'aux_co1_4'],
        ['Auxiliary cooling water flowrate, gpm', 'aux_co2_1', 'aux_co2_2', 'aux_co2_3', 'aux_co2_4']
      ];
      drawTable(genHeaders, genRows, (row, ci) => (ci === 0 ? row[0] : fieldVal(row[ci])));

      addSubTitle('Flue Gas Analysis');
      const flueHeaders = ['Parameters', 'Gen-1', 'Gen-2', 'Gen-3', 'Gen-4'];
      const flueRows = [
        ['O2 (%)', 'gen_o2_1', 'gen_o2_2', 'gen_o2_3', 'gen_o2_4'],
        ['CO (ppm)', 'gen_co_1', 'gen_co_2', 'gen_co_3', 'gen_co_4'],
        ['CO2 (%)', 'gen_co2_1', 'gen_co2_2', 'gen_co2_3', 'gen_co2_4'],
        ['T flue (°F)', 'gen_tflue_1', 'gen_tflue_2', 'gen_tflue_3', 'gen_tflue_4'],
        ['T air (°F)', 'gen_tair_1', 'gen_tair_2', 'gen_tair_3', 'gen_tair_4'],
        ['ΔT (°F)', 'gen_dt_1', 'gen_dt_2', 'gen_dt_3', 'gen_dt_4'],
        ['RH (%)', 'gen_rh_1', 'gen_rh_2', 'gen_rh_3', 'gen_rh_4']
      ];
      drawTable(flueHeaders, flueRows, (row, ci) => (ci === 0 ? row[0] : fieldVal(row[ci])));
      addSectionNotesToPdf(ctx, 'generator', 'Generator', data);
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const str = 'Page ' + p + ' of ' + totalPages;
      doc.text(str, (doc.internal.pageSize.getWidth() - doc.getTextWidth(str)) / 2, doc.internal.pageSize.getHeight() - 8);
      doc.setTextColor(0, 0, 0);
    }
    return doc;
  }

  async function downloadPdf() {
    try {
      saveStatus.textContent = 'Preparing PDF…';
      const doc = await buildPdfFull();
      const facility = (getFormData().fields.facility_name || 'Form').replace(/\s+/g, '-');
      const name = 'ITAC-Energy-Audit-' + facility + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
      doc.save(name);
      saveStatus.textContent = 'PDF downloaded';
      setTimeout(() => showStatus('Saved', false), 2000);
    } catch (e) {
      console.error(e);
      saveStatus.textContent = (e && e.message) ? e.message : 'PDF error – open in Safari or HTML Viewer app';
    }
  }

  downloadPdfBtn.addEventListener('click', downloadPdf);
  downloadPdfBottom.addEventListener('click', downloadPdf);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  function addNotesPage(sectionId) {
    const container = form.querySelector('.notes-pages-container[data-section="' + sectionId + '"]');
    if (!container) return;
    const countInput = container.querySelector('input[name="notes_page_count_' + sectionId + '"]');
    const count = parseInt(countInput.value, 10) || 0;
    const nextIndex = count;
    countInput.value = nextIndex + 1;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'notes-page';
    pageDiv.setAttribute('data-page-index', nextIndex);
    pageDiv.innerHTML = `
      <label>Notes page ${nextIndex + 1}</label>
      <textarea name="notes_page_${sectionId}_${nextIndex}" rows="14" placeholder="Use this area for handwritten notes or extra details…"></textarea>
    `;
    const addBtn = container.querySelector('.btn-add-notes-page');
    container.insertBefore(pageDiv, addBtn);

    pageDiv.querySelector('textarea').addEventListener('input', scheduleSave);
    scheduleSave();
  }

  document.querySelectorAll('.btn-add-notes-page').forEach((btn) => {
    btn.addEventListener('click', () => addNotesPage(btn.getAttribute('data-section')));
  });

  function ensureNotesPagesForSection(sectionId, count, data) {
    const container = form.querySelector('.notes-pages-container[data-section="' + sectionId + '"]');
    if (!container) return;
    const countInput = container.querySelector('input[name="notes_page_count_' + sectionId + '"]');
    const existingPages = container.querySelectorAll('.notes-page');
    let currentCount = existingPages.length;
    while (currentCount < count) {
      const nextIndex = currentCount;
      countInput.value = nextIndex + 1;
      const pageDiv = document.createElement('div');
      pageDiv.className = 'notes-page';
      pageDiv.setAttribute('data-page-index', nextIndex);
      pageDiv.innerHTML = `
        <label>Notes page ${nextIndex + 1}</label>
        <textarea name="notes_page_${sectionId}_${nextIndex}" rows="14" placeholder="Use this area for handwritten notes or extra details…"></textarea>
      `;
      const addBtn = container.querySelector('.btn-add-notes-page');
      container.insertBefore(pageDiv, addBtn);
      const val = (data.fields && data.fields['notes_page_' + sectionId + '_' + nextIndex]) || '';
      pageDiv.querySelector('textarea').value = val;
      pageDiv.querySelector('textarea').addEventListener('input', scheduleSave);
      currentCount++;
    }
  }

  const originalSetFormData = setFormData;
  setFormData = function (data) {
    originalSetFormData(data);
    if (!data || !data.fields) return;
    TAB_IDS.forEach((sectionId) => {
      const count = parseInt(data.fields['notes_page_count_' + sectionId], 10) || 1;
      ensureNotesPagesForSection(sectionId, count, data);
    });
  };

  initTabs();
  load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runApp);
  } else {
    runApp();
  }
})();
