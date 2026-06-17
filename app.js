(function () {
  'use strict';

  const VERSION = '2.0.0';
  const LEADS_KEY = 'blascorIaComercialLeads';
  const SELLERS_KEY = 'blascorIaComercialSellers';
  const ACTIVE_SELLER_KEY = 'blascorIaComercialActiveSeller';
  const STATUS_OPTIONS = ['Pendente', 'Quente', 'Morno', 'Frio', 'Retornar', 'Convertido'];
  const PRIORITY_OPTIONS = ['Alta', 'Média', 'Baixa'];

  const hotWords = ['interesse', 'catálogo', 'catalogo', 'comprador', 'pedido', 'orçamento', 'orcamento', 'whatsapp', 'reunião', 'reuniao'];
  const warmWords = ['retornar', 'analisar', 'depois', 'semana que vem', 'ligar outro dia'];
  const coldWords = ['não tem interesse', 'nao tem interesse', 'não trabalha', 'nao trabalha', 'já tem fornecedor', 'ja tem fornecedor', 'não quer', 'nao quer'];

  const state = {
    leads: [],
    sellers: [],
    activeSellerId: '',
    currentTab: 'operation',
    nextLeadIndex: 0,
    pendingImport: []
  };

  const $ = (id) => document.getElementById(id);

  const elements = {
    activeSeller: $('activeSeller'),
    leadForm: $('leadForm'),
    leadId: $('leadId'),
    formTitle: $('formTitle'),
    cancelEditBtn: $('cancelEditBtn'),
    company: $('company'),
    city: $('city'),
    stateField: $('state'),
    phone: $('phone'),
    whatsapp: $('whatsapp'),
    buyer: $('buyer'),
    seller: $('seller'),
    priority: $('priority'),
    lastPurchaseDate: $('lastPurchaseDate'),
    lastPurchaseValue: $('lastPurchaseValue'),
    status: $('status'),
    returnAt: $('returnAt'),
    notes: $('notes'),
    internalNotes: $('internalNotes'),
    searchInput: $('searchInput'),
    statusFilter: $('statusFilter'),
    priorityFilter: $('priorityFilter'),
    tableBody: $('leadsTableBody'),
    emptyState: $('emptyState'),
    totalCount: $('totalCount'),
    callsCount: $('callsCount'),
    conversionCount: $('conversionCount'),
    hotCount: $('hotCount'),
    overdueCount: $('overdueCount'),
    returnCount: $('returnCount'),
    exportCsvBtn: $('exportCsvBtn'),
    exportExcelBtn: $('exportExcelBtn'),
    csvInput: $('csvInput'),
    clearBaseBtn: $('clearBaseBtn'),
    copyScriptBtn: $('copyScriptBtn'),
    salesScript: $('salesScript'),
    summaryDialog: $('summaryDialog'),
    summaryLeadName: $('summaryLeadName'),
    summaryLeadId: $('summaryLeadId'),
    contactType: $('contactType'),
    contactResult: $('contactResult'),
    callSummary: $('callSummary'),
    summaryReturnAt: $('summaryReturnAt'),
    summarySeller: $('summarySeller'),
    classificationHint: $('classificationHint'),
    contactHistoryList: $('contactHistoryList'),
    saveSummaryBtn: $('saveSummaryBtn'),
    nextLeadName: $('nextLeadName'),
    nextLeadMeta: $('nextLeadMeta'),
    nextLeadNotes: $('nextLeadNotes'),
    callNextBtn: $('callNextBtn'),
    skipNextBtn: $('skipNextBtn'),
    summaryNextBtn: $('summaryNextBtn'),
    editNextBtn: $('editNextBtn'),
    nextQueueList: $('nextQueueList'),
    sellerForm: $('sellerForm'),
    sellerId: $('sellerId'),
    sellerName: $('sellerName'),
    sellerContact: $('sellerContact'),
    sellersTableBody: $('sellersTableBody'),
    refreshReportsBtn: $('refreshReportsBtn'),
    productivityTableBody: $('productivityTableBody'),
    statusChart: $('statusChart'),
    callsChart: $('callsChart'),
    returnsChart: $('returnsChart'),
    importDialog: $('importDialog'),
    importSummary: $('importSummary'),
    importPreviewBody: $('importPreviewBody'),
    confirmImportBtn: $('confirmImportBtn'),
    toast: $('toast')
  };

  const storageService = {
    load(key, fallback) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || 'null');
        return data || fallback;
      } catch (error) {
        console.warn('Falha ao ler storage local.', error);
        return fallback;
      }
    },
    save(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  const dialerService = {
    call(phone) {
      const number = cleanPhone(phone);
      if (!number) {
        showToast('Telefone inválido para ligação.');
        return false;
      }
      window.location.href = `tel:${number}`;
      showToast(`Abrindo ligação para ${number}.`);
      return true;
    },
    getMicroSipCommand(phone) {
      return `"C:\\Program Files\\MicroSIP\\microsip.exe" ${cleanPhone(phone)}`;
    }
  };

  const protheusAdapter = {
    buildCustomerPayload(lead) {
      return {
        origem: 'BLASCOR_IA_COMERCIAL',
        empresa: lead.company,
        cidade: lead.city,
        estado: lead.state,
        telefone: cleanPhone(lead.phone),
        whatsapp: cleanPhone(lead.whatsapp),
        comprador: lead.buyer,
        representante: getSellerName(lead.sellerId),
        statusComercial: lead.status,
        prioridade: lead.priority,
        ultimaCompra: lead.lastPurchaseDate,
        valorUltimaCompra: Number(lead.lastPurchaseValue || 0),
        observacoes: lead.notes,
        observacoesInternas: lead.internalNotes
      };
    },
    buildHistoryPayload(lead) {
      return (lead.contacts || []).map((contact) => ({
        leadId: lead.id,
        data: contact.createdAt,
        tipo: contact.type,
        resultado: contact.result,
        vendedor: getSellerName(contact.sellerId),
        resumo: contact.summary
      }));
    }
  };

  function init() {
    state.sellers = migrateSellers(storageService.load(SELLERS_KEY, []));
    state.leads = migrateLeads(storageService.load(LEADS_KEY, []));
    state.activeSellerId = localStorage.getItem(ACTIVE_SELLER_KEY) || state.sellers[0].id;
    persistAll();
    bindEvents();
    populateSellerSelects();
    render();
    exposeIntegrationSurface();
  }

  function migrateSellers(sellers) {
    const normalized = Array.isArray(sellers) ? sellers : [];
    if (!normalized.length) {
      return [
        { id: 'seller-default', name: 'Comercial Blascor', contact: '', createdAt: new Date().toISOString() }
      ];
    }
    return normalized.map((seller) => ({
      id: seller.id || createId('seller'),
      name: seller.name || 'Vendedor',
      contact: seller.contact || '',
      createdAt: seller.createdAt || new Date().toISOString()
    }));
  }

  function migrateLeads(leads) {
    return (Array.isArray(leads) ? leads : []).map((lead) => {
      const contacts = Array.isArray(lead.contacts) ? lead.contacts : [];
      if (lead.callSummary && !contacts.length) {
        contacts.push({
          id: createId('contact'),
          type: 'Ligação',
          result: lead.status === 'Convertido' ? 'Conversão' : 'Resumo',
          summary: lead.callSummary,
          sellerId: lead.sellerId || state.sellers[0].id,
          createdAt: lead.updatedAt || new Date().toISOString()
        });
      }
      return {
        id: lead.id || createId('lead'),
        company: lead.company || '',
        city: lead.city || '',
        state: lead.state || '',
        phone: lead.phone || '',
        whatsapp: lead.whatsapp || '',
        buyer: lead.buyer || '',
        sellerId: lead.sellerId || state.sellers[0].id,
        priority: PRIORITY_OPTIONS.includes(lead.priority) ? lead.priority : 'Média',
        lastPurchaseDate: lead.lastPurchaseDate || '',
        lastPurchaseValue: lead.lastPurchaseValue || '',
        status: STATUS_OPTIONS.includes(lead.status) ? lead.status : 'Pendente',
        returnAt: lead.returnAt || '',
        notes: lead.notes || '',
        internalNotes: lead.internalNotes || '',
        callSummary: lead.callSummary || '',
        contacts,
        createdAt: lead.createdAt || lead.updatedAt || new Date().toISOString(),
        updatedAt: lead.updatedAt || new Date().toISOString()
      };
    });
  }

  function bindEvents() {
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    elements.leadForm.addEventListener('submit', handleLeadSubmit);
    elements.cancelEditBtn.addEventListener('click', resetLeadForm);
    elements.searchInput.addEventListener('input', renderTable);
    elements.statusFilter.addEventListener('change', renderTable);
    elements.priorityFilter.addEventListener('change', renderTable);
    elements.exportCsvBtn.addEventListener('click', exportCsv);
    elements.exportExcelBtn.addEventListener('click', exportExcel);
    elements.csvInput.addEventListener('change', (event) => prepareImport(event.target.files[0]));
    elements.clearBaseBtn.addEventListener('click', clearBase);
    elements.copyScriptBtn.addEventListener('click', copyScript);
    elements.saveSummaryBtn.addEventListener('click', saveContact);
    elements.callNextBtn.addEventListener('click', callNextLead);
    elements.skipNextBtn.addEventListener('click', skipNextLead);
    elements.summaryNextBtn.addEventListener('click', openNextSummary);
    elements.editNextBtn.addEventListener('click', editNextLead);
    elements.sellerForm.addEventListener('submit', handleSellerSubmit);
    elements.refreshReportsBtn.addEventListener('click', renderProductivity);
    elements.confirmImportBtn.addEventListener('click', confirmImport);
    elements.activeSeller.addEventListener('change', () => {
      state.activeSellerId = elements.activeSeller.value;
      localStorage.setItem(ACTIVE_SELLER_KEY, state.activeSellerId);
      render();
    });
  }

  function switchTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    $(`${tabName}Panel`).classList.add('active');
    if (tabName === 'dashboard') renderCharts();
    if (tabName === 'reports') renderProductivity();
    if (tabName === 'next') renderNextLead();
  }

  function persistAll() {
    storageService.save(SELLERS_KEY, state.sellers);
    storageService.save(LEADS_KEY, state.leads);
  }

  function populateSellerSelects() {
    [elements.activeSeller, elements.seller, elements.summarySeller].forEach((select) => {
      select.replaceChildren();
      state.sellers.forEach((seller) => {
        const option = document.createElement('option');
        option.value = seller.id;
        option.textContent = seller.name;
        select.appendChild(option);
      });
    });
    elements.activeSeller.value = state.activeSellerId;
    elements.seller.value = state.activeSellerId;
    elements.summarySeller.value = state.activeSellerId;
  }

  function render() {
    populateSellerSelects();
    renderSummaryCards();
    renderTable();
    renderNextLead();
    renderSellers();
    renderProductivity();
    if (state.currentTab === 'dashboard') renderCharts();
  }

  function getMetrics() {
    const totalCalls = state.leads.reduce((sum, lead) => sum + (lead.contacts || []).filter((contact) => contact.type === 'Ligação').length, 0);
    return {
      totalLeads: state.leads.length,
      totalCalls,
      conversions: state.leads.filter((lead) => lead.status === 'Convertido').length,
      hot: countByStatus('Quente'),
      returnsPending: state.leads.filter((lead) => lead.returnAt).length,
      overdue: state.leads.filter(isReturnOverdue).length
    };
  }

  function renderSummaryCards() {
    const metrics = getMetrics();
    elements.totalCount.textContent = metrics.totalLeads;
    elements.callsCount.textContent = metrics.totalCalls;
    elements.conversionCount.textContent = metrics.conversions;
    elements.hotCount.textContent = metrics.hot;
    elements.returnCount.textContent = metrics.returnsPending;
    elements.overdueCount.textContent = metrics.overdue;
  }

  function getLeadFromForm() {
    return {
      id: elements.leadId.value || createId('lead'),
      company: elements.company.value.trim(),
      city: elements.city.value.trim(),
      state: elements.stateField.value.trim().toUpperCase(),
      phone: elements.phone.value.trim(),
      whatsapp: elements.whatsapp.value.trim(),
      buyer: elements.buyer.value.trim(),
      sellerId: elements.seller.value || state.activeSellerId,
      priority: elements.priority.value,
      lastPurchaseDate: elements.lastPurchaseDate.value,
      lastPurchaseValue: elements.lastPurchaseValue.value,
      status: elements.status.value,
      returnAt: elements.returnAt.value,
      notes: elements.notes.value.trim(),
      internalNotes: elements.internalNotes.value.trim(),
      updatedAt: new Date().toISOString()
    };
  }

  function handleLeadSubmit(event) {
    event.preventDefault();
    const formLead = getLeadFromForm();
    if (!formLead.company || !formLead.city || !formLead.state || !cleanPhone(formLead.phone)) {
      showToast('Preencha empresa, cidade, estado e telefone válido.');
      return;
    }
    const index = state.leads.findIndex((lead) => lead.id === formLead.id);
    if (index >= 0) {
      state.leads[index] = { ...state.leads[index], ...formLead };
      showToast('Lead atualizado.');
    } else {
      state.leads.unshift({
        ...formLead,
        callSummary: '',
        contacts: [],
        createdAt: new Date().toISOString()
      });
      showToast('Lead cadastrado.');
    }
    persistAll();
    resetLeadForm();
    render();
  }

  function resetLeadForm() {
    elements.leadForm.reset();
    elements.leadId.value = '';
    elements.seller.value = state.activeSellerId;
    elements.priority.value = 'Média';
    elements.status.value = 'Pendente';
    elements.formTitle.textContent = 'Novo lead';
    elements.cancelEditBtn.classList.add('hidden');
  }

  function getFilteredLeads() {
    const query = normalizeText(elements.searchInput.value);
    const numericQuery = cleanPhone(elements.searchInput.value);
    const selectedStatus = elements.statusFilter.value;
    const selectedPriority = elements.priorityFilter.value;
    return state.leads.filter((lead) => {
      const searchable = normalizeText(`${lead.company} ${lead.city} ${lead.phone} ${cleanPhone(lead.phone)} ${getSellerName(lead.sellerId)}`);
      const matchesQuery = !query || searchable.includes(query) || (numericQuery && cleanPhone(lead.phone).includes(numericQuery));
      const matchesStatus = selectedStatus === 'Todos' || lead.status === selectedStatus || (selectedStatus === 'Vencidos' && isReturnOverdue(lead));
      const matchesPriority = selectedPriority === 'Todas' || lead.priority === selectedPriority;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }

  function renderTable() {
    const filteredLeads = getFilteredLeads();
    elements.tableBody.replaceChildren();
    elements.emptyState.classList.toggle('hidden', filteredLeads.length > 0);
    filteredLeads.forEach((lead) => {
      const row = document.createElement('tr');
      row.classList.toggle('overdue-row', isReturnOverdue(lead));
      row.append(
        createCompanyCell(lead),
        createTextCell(`${lead.city || '-'} / ${lead.state || '-'}`),
        createTextCell(lead.phone || '-'),
        createTextCell(getSellerName(lead.sellerId)),
        createPriorityCell(lead.priority),
        createStatusCell(lead.status),
        createReturnCell(lead),
        createActionsCell(lead)
      );
      elements.tableBody.appendChild(row);
    });
  }

  function createCompanyCell(lead) {
    const cell = document.createElement('td');
    const company = document.createElement('div');
    const notes = document.createElement('div');
    const pills = document.createElement('div');
    company.className = 'lead-company';
    company.textContent = lead.company || '-';
    notes.className = 'lead-notes';
    notes.textContent = lead.notes || lead.callSummary || '';
    pills.className = 'pill-row';
    if (isReturnOverdue(lead)) {
      const overdue = document.createElement('span');
      overdue.className = 'overdue-pill';
      overdue.textContent = 'Vencido';
      pills.appendChild(overdue);
    }
    cell.append(company, notes, pills);
    return cell;
  }

  function createTextCell(text) {
    const cell = document.createElement('td');
    cell.textContent = text;
    return cell;
  }

  function createStatusCell(status) {
    const cell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `status-pill status-${normalizeText(status)}`;
    pill.textContent = status;
    cell.appendChild(pill);
    return cell;
  }

  function createPriorityCell(priority) {
    const cell = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = `priority-pill priority-${normalizeText(priority || 'Média')}`;
    pill.textContent = priority || 'Média';
    cell.appendChild(pill);
    return cell;
  }

  function createReturnCell(lead) {
    const cell = document.createElement('td');
    cell.textContent = lead.returnAt ? formatDateTime(lead.returnAt) : '-';
    if (isReturnOverdue(lead)) {
      const flag = document.createElement('div');
      flag.className = 'lead-notes';
      flag.textContent = 'Retorno vencido';
      cell.appendChild(flag);
    }
    return cell;
  }

  function createActionsCell(lead) {
    const cell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      createActionButton('Ligar', () => callLead(lead)),
      createActionButton('Contato', () => openContactDialog(lead)),
      createActionButton('Retornar', () => quickScheduleReturn(lead.id)),
      createActionButton('Editar', () => editLead(lead.id)),
      createActionButton('Excluir', () => deleteLead(lead.id), 'danger')
    );
    cell.appendChild(actions);
    return cell;
  }

  function createActionButton(label, handler, variant) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button ${variant || 'secondary'}`;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function callLead(lead) {
    const called = dialerService.call(lead.phone);
    if (!called) return;
    addContact(lead.id, {
      type: 'Ligação',
      result: 'Ligação iniciada',
      summary: 'Ligação iniciada pelo botão Ligar.',
      sellerId: state.activeSellerId
    }, false);
    persistAll();
    render();
  }

  function openContactDialog(lead) {
    elements.summaryLeadId.value = lead.id;
    elements.summaryLeadName.textContent = lead.company || 'Lead';
    elements.contactType.value = 'Ligação';
    elements.contactResult.value = 'Resumo';
    elements.callSummary.value = '';
    elements.summaryReturnAt.value = lead.returnAt || '';
    elements.summarySeller.value = lead.sellerId || state.activeSellerId;
    elements.classificationHint.textContent = 'A classificação será atualizada automaticamente ao salvar.';
    renderContactHistory(lead);
    elements.summaryDialog.showModal();
    elements.callSummary.focus();
  }

  function renderContactHistory(lead) {
    elements.contactHistoryList.replaceChildren();
    const contacts = [...(lead.contacts || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (!contacts.length) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'Nenhum contato registrado.';
      elements.contactHistoryList.appendChild(empty);
      return;
    }
    contacts.forEach((contact) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const title = document.createElement('strong');
      title.textContent = `${formatDateTime(contact.createdAt)} · ${contact.type} · ${contact.result}`;
      const seller = document.createElement('span');
      seller.className = 'muted-text';
      seller.textContent = getSellerName(contact.sellerId);
      const summary = document.createElement('p');
      summary.textContent = contact.summary || '-';
      item.append(title, seller, summary);
      elements.contactHistoryList.appendChild(item);
    });
  }

  function saveContact() {
    const lead = findLead(elements.summaryLeadId.value);
    if (!lead) return;
    const summary = elements.callSummary.value.trim();
    const result = elements.contactResult.value;
    const classification = result === 'Conversão' ? 'Convertido' : classifySummary(summary);
    addContact(lead.id, {
      type: elements.contactType.value,
      result,
      summary,
      sellerId: elements.summarySeller.value
    }, false);
    lead.callSummary = summary || lead.callSummary;
    lead.notes = summary || lead.notes;
    lead.status = result === 'Retornar' ? 'Retornar' : classification;
    lead.returnAt = elements.summaryReturnAt.value;
    lead.sellerId = elements.summarySeller.value || lead.sellerId;
    lead.updatedAt = new Date().toISOString();
    persistAll();
    render();
    elements.summaryDialog.close();
    showToast(`Contato salvo. Lead classificado como ${lead.status}.`);
  }

  function addContact(leadId, contact, shouldPersist) {
    const lead = findLead(leadId);
    if (!lead) return;
    lead.contacts = Array.isArray(lead.contacts) ? lead.contacts : [];
    lead.contacts.push({
      id: createId('contact'),
      type: contact.type || 'Ligação',
      result: contact.result || 'Resumo',
      summary: contact.summary || '',
      sellerId: contact.sellerId || state.activeSellerId,
      createdAt: new Date().toISOString()
    });
    lead.updatedAt = new Date().toISOString();
    if (shouldPersist) {
      persistAll();
      render();
    }
  }

  function quickScheduleReturn(id) {
    const lead = findLead(id);
    if (!lead) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    lead.status = 'Retornar';
    lead.returnAt = toDateTimeLocal(tomorrow);
    lead.updatedAt = new Date().toISOString();
    addContact(id, {
      type: 'Ligação',
      result: 'Retornar',
      summary: 'Retorno rápido agendado para o próximo dia útil sugerido.',
      sellerId: state.activeSellerId
    }, false);
    persistAll();
    render();
    showToast('Retorno agendado para amanhã às 09:00.');
  }

  function editLead(id) {
    const lead = findLead(id);
    if (!lead) return;
    elements.leadId.value = lead.id;
    elements.company.value = lead.company || '';
    elements.city.value = lead.city || '';
    elements.stateField.value = lead.state || '';
    elements.phone.value = lead.phone || '';
    elements.whatsapp.value = lead.whatsapp || '';
    elements.buyer.value = lead.buyer || '';
    elements.seller.value = lead.sellerId || state.activeSellerId;
    elements.priority.value = lead.priority || 'Média';
    elements.lastPurchaseDate.value = lead.lastPurchaseDate || '';
    elements.lastPurchaseValue.value = lead.lastPurchaseValue || '';
    elements.status.value = lead.status || 'Pendente';
    elements.returnAt.value = lead.returnAt || '';
    elements.notes.value = lead.notes || '';
    elements.internalNotes.value = lead.internalNotes || '';
    elements.formTitle.textContent = 'Editar lead';
    elements.cancelEditBtn.classList.remove('hidden');
    switchTab('operation');
    elements.company.focus();
  }

  function deleteLead(id) {
    const lead = findLead(id);
    const name = lead ? lead.company : 'este lead';
    if (!confirm(`Excluir ${name}?`)) return;
    state.leads = state.leads.filter((item) => item.id !== id);
    persistAll();
    render();
    showToast('Lead excluído.');
  }

  function getNextQueue() {
    const priorityWeight = { Alta: 0, Média: 1, Baixa: 2 };
    return state.leads
      .filter((lead) => lead.status !== 'Convertido' && lead.status !== 'Frio')
      .sort((a, b) => {
        const overdueDelta = Number(!isReturnOverdue(a)) - Number(!isReturnOverdue(b));
        if (overdueDelta) return overdueDelta;
        const returnDelta = returnTimeValue(a) - returnTimeValue(b);
        if (returnDelta) return returnDelta;
        return (priorityWeight[a.priority] || 1) - (priorityWeight[b.priority] || 1);
      });
  }

  function renderNextLead() {
    const queue = getNextQueue();
    const lead = queue[state.nextLeadIndex] || queue[0];
    state.nextLeadIndex = lead ? Math.min(state.nextLeadIndex, queue.length - 1) : 0;
    elements.nextLeadMeta.replaceChildren();
    elements.nextQueueList.replaceChildren();
    if (!lead) {
      elements.nextLeadName.textContent = 'Nenhum lead disponível';
      elements.nextLeadNotes.textContent = 'Cadastre leads ou ajuste os filtros de status para montar uma fila.';
      return;
    }
    elements.nextLeadName.textContent = lead.company;
    elements.nextLeadNotes.textContent = lead.notes || lead.internalNotes || 'Sem observações registradas.';
    [
      ['Telefone', lead.phone || '-'],
      ['Cidade/UF', `${lead.city || '-'} / ${lead.state || '-'}`],
      ['Representante', getSellerName(lead.sellerId)],
      ['Prioridade', lead.priority || 'Média'],
      ['Status', lead.status],
      ['Retorno', lead.returnAt ? formatDateTime(lead.returnAt) : 'Sem agenda']
    ].forEach(([label, value]) => {
      const item = document.createElement('div');
      const strong = document.createElement('strong');
      const span = document.createElement('span');
      strong.textContent = label;
      span.textContent = value;
      item.append(strong, span);
      elements.nextLeadMeta.appendChild(item);
    });
    queue.slice(0, 6).forEach((itemLead) => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      const strong = document.createElement('strong');
      const span = document.createElement('span');
      strong.textContent = itemLead.company;
      span.textContent = `${itemLead.priority} · ${itemLead.status} · ${itemLead.returnAt ? formatDateTime(itemLead.returnAt) : 'sem retorno'}`;
      item.append(strong, span);
      elements.nextQueueList.appendChild(item);
    });
  }

  function getCurrentNextLead() {
    const queue = getNextQueue();
    return queue[state.nextLeadIndex] || queue[0];
  }

  function callNextLead() {
    const lead = getCurrentNextLead();
    if (!lead) return showToast('Não há lead na fila.');
    callLead(lead);
  }

  function skipNextLead() {
    const queue = getNextQueue();
    if (!queue.length) return;
    state.nextLeadIndex = (state.nextLeadIndex + 1) % queue.length;
    renderNextLead();
  }

  function openNextSummary() {
    const lead = getCurrentNextLead();
    if (!lead) return showToast('Não há lead na fila.');
    openContactDialog(lead);
  }

  function editNextLead() {
    const lead = getCurrentNextLead();
    if (!lead) return showToast('Não há lead na fila.');
    editLead(lead.id);
  }

  function handleSellerSubmit(event) {
    event.preventDefault();
    const seller = {
      id: elements.sellerId.value || createId('seller'),
      name: elements.sellerName.value.trim(),
      contact: elements.sellerContact.value.trim(),
      createdAt: new Date().toISOString()
    };
    if (!seller.name) {
      showToast('Informe o nome do vendedor.');
      return;
    }
    const index = state.sellers.findIndex((item) => item.id === seller.id);
    if (index >= 0) {
      state.sellers[index] = { ...state.sellers[index], ...seller };
    } else {
      state.sellers.push(seller);
    }
    state.activeSellerId = state.activeSellerId || seller.id;
    elements.sellerForm.reset();
    elements.sellerId.value = '';
    persistAll();
    render();
    showToast('Vendedor salvo.');
  }

  function renderSellers() {
    elements.sellersTableBody.replaceChildren();
    state.sellers.forEach((seller) => {
      const metrics = getSellerMetrics(seller.id);
      const row = document.createElement('tr');
      row.append(
        createTextCell(seller.name),
        createTextCell(seller.contact || '-'),
        createTextCell(metrics.leads),
        createTextCell(metrics.calls),
        createTextCell(metrics.conversions),
        createSellerActionsCell(seller)
      );
      elements.sellersTableBody.appendChild(row);
    });
  }

  function createSellerActionsCell(seller) {
    const cell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      createActionButton('Editar', () => {
        elements.sellerId.value = seller.id;
        elements.sellerName.value = seller.name;
        elements.sellerContact.value = seller.contact || '';
        elements.sellerName.focus();
      }),
      createActionButton('Usar', () => {
        state.activeSellerId = seller.id;
        localStorage.setItem(ACTIVE_SELLER_KEY, seller.id);
        render();
      })
    );
    if (state.sellers.length > 1) {
      actions.appendChild(createActionButton('Excluir', () => deleteSeller(seller.id), 'danger'));
    }
    cell.appendChild(actions);
    return cell;
  }

  function deleteSeller(id) {
    if (!confirm('Excluir este vendedor? Leads vinculados serão movidos para o vendedor ativo.')) return;
    const replacement = state.sellers.find((seller) => seller.id !== id);
    state.leads.forEach((lead) => {
      if (lead.sellerId === id) lead.sellerId = replacement.id;
      (lead.contacts || []).forEach((contact) => {
        if (contact.sellerId === id) contact.sellerId = replacement.id;
      });
    });
    state.sellers = state.sellers.filter((seller) => seller.id !== id);
    state.activeSellerId = replacement.id;
    persistAll();
    render();
  }

  function renderProductivity() {
    elements.productivityTableBody.replaceChildren();
    state.sellers.forEach((seller) => {
      const metrics = getSellerMetrics(seller.id);
      const rate = metrics.calls ? `${Math.round((metrics.conversions / metrics.calls) * 100)}%` : '0%';
      const row = document.createElement('tr');
      row.append(
        createTextCell(seller.name),
        createTextCell(metrics.leads),
        createTextCell(metrics.calls),
        createTextCell(metrics.conversions),
        createTextCell(metrics.returnsPending),
        createTextCell(metrics.overdue),
        createTextCell(rate)
      );
      elements.productivityTableBody.appendChild(row);
    });
  }

  function getSellerMetrics(sellerId) {
    const sellerLeads = state.leads.filter((lead) => lead.sellerId === sellerId);
    const calls = state.leads.reduce((sum, lead) => sum + (lead.contacts || []).filter((contact) => contact.sellerId === sellerId && contact.type === 'Ligação').length, 0);
    return {
      leads: sellerLeads.length,
      calls,
      conversions: sellerLeads.filter((lead) => lead.status === 'Convertido').length,
      returnsPending: sellerLeads.filter((lead) => lead.returnAt).length,
      overdue: sellerLeads.filter(isReturnOverdue).length
    };
  }

  function renderCharts() {
    const statusData = STATUS_OPTIONS.map((status) => ({ label: status, value: countByStatus(status) }));
    drawBarChart(elements.statusChart, statusData, ['#667085', '#168a4a', '#d97706', '#475467', '#f4b400', '#0b5cab']);
    const metrics = getMetrics();
    drawBarChart(elements.callsChart, [
      { label: 'Ligações', value: metrics.totalCalls },
      { label: 'Conversões', value: metrics.conversions },
      { label: 'Quentes', value: metrics.hot },
      { label: 'Retornos', value: metrics.returnsPending }
    ], ['#f4b400', '#168a4a', '#0b5cab', '#d97706']);
    drawBarChart(elements.returnsChart, PRIORITY_OPTIONS.map((priority) => ({
      label: priority,
      value: state.leads.filter((lead) => lead.returnAt && lead.priority === priority).length
    })), ['#d9232e', '#d97706', '#168a4a']);
  }

  function drawBarChart(canvas, data, colors) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 36;
    const max = Math.max(1, ...data.map((item) => item.value));
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#d9e0e7';
    ctx.beginPath();
    ctx.moveTo(padding, padding / 2);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - 10, height - padding);
    ctx.stroke();
    const gap = 18;
    const barWidth = Math.max(26, (width - padding - 24 - gap * data.length) / data.length);
    data.forEach((item, index) => {
      const barHeight = ((height - padding * 2) * item.value) / max;
      const x = padding + 12 + index * (barWidth + gap);
      const y = height - padding - barHeight;
      ctx.fillStyle = colors[index % colors.length];
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = '#1f2933';
      ctx.font = '14px Arial';
      ctx.fillText(String(item.value), x, Math.max(18, y - 7));
      ctx.font = '12px Arial';
      ctx.fillText(item.label.slice(0, 14), x, height - 12);
    });
  }

  function exportCsv() {
    if (!state.leads.length) return showToast('Não há leads para exportar.');
    const csv = rowsToCsv(getLeadExportRows());
    downloadBlob(`\uFEFF${csv}`, 'text/csv;charset=utf-8;', `blascor-leads-v2-${today()}.csv`);
  }

  function exportExcel() {
    if (!state.leads.length) return showToast('Não há leads para exportar.');
    const leadsTable = tableToHtml('Leads', getLeadExportRows());
    const productivityTable = tableToHtml('Produtividade', getProductivityExportRows());
    const historyRows = [['Empresa', 'Data', 'Tipo', 'Resultado', 'Vendedor', 'Resumo']];
    state.leads.forEach((lead) => {
      (lead.contacts || []).forEach((contact) => {
        historyRows.push([lead.company, formatDateTime(contact.createdAt), contact.type, contact.result, getSellerName(contact.sellerId), contact.summary]);
      });
    });
    const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>${leadsTable}<br>${productivityTable}<br>${tableToHtml('Histórico de contatos', historyRows)}</body></html>`;
    downloadBlob(html, 'application/vnd.ms-excel;charset=utf-8;', `blascor-relatorio-v2-${today()}.xls`);
  }

  function getLeadExportRows() {
    return [
      ['Empresa', 'Cidade', 'Estado', 'Telefone', 'WhatsApp', 'Comprador', 'Representante', 'Prioridade', 'Status', 'Retorno', 'Última compra', 'Valor última compra', 'Observações', 'Observações internas', 'Total contatos', 'Atualizado em'],
      ...state.leads.map((lead) => [
        lead.company, lead.city, lead.state, lead.phone, lead.whatsapp, lead.buyer, getSellerName(lead.sellerId), lead.priority,
        lead.status, lead.returnAt ? formatDateTime(lead.returnAt) : '', lead.lastPurchaseDate, lead.lastPurchaseValue,
        lead.notes, lead.internalNotes, (lead.contacts || []).length, formatDateTime(lead.updatedAt)
      ])
    ];
  }

  function getProductivityExportRows() {
    return [
      ['Vendedor', 'Leads', 'Ligações', 'Conversões', 'Retornos pendentes', 'Retornos vencidos'],
      ...state.sellers.map((seller) => {
        const metrics = getSellerMetrics(seller.id);
        return [seller.name, metrics.leads, metrics.calls, metrics.conversions, metrics.returnsPending, metrics.overdue];
      })
    ];
  }

  function rowsToCsv(rows) {
    return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
  }

  function tableToHtml(title, rows) {
    const htmlRows = rows.map((row, index) => {
      const tag = index === 0 ? 'th' : 'td';
      return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
    }).join('');
    return `<h2>${escapeHtml(title)}</h2><table border="1">${htmlRows}</table>`;
  }

  function prepareImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''));
      state.pendingImport = validateImportRows(parsed);
      renderImportPreview();
      elements.csvInput.value = '';
      elements.importDialog.showModal();
    };
    reader.readAsText(file, 'UTF-8');
  }

  function validateImportRows(rows) {
    const seenPhones = new Set(state.leads.map((lead) => cleanPhone(lead.phone)));
    return rows.map((lead, index) => {
      const errors = [];
      const phone = cleanPhone(lead.phone);
      if (!lead.company) errors.push('Empresa obrigatória');
      if (!phone) errors.push('Telefone obrigatório');
      if (phone && seenPhones.has(phone)) errors.push('Telefone duplicado');
      if (!lead.city) errors.push('Cidade obrigatória');
      if (!lead.state) errors.push('Estado obrigatório');
      if (!STATUS_OPTIONS.includes(lead.status)) lead.status = 'Pendente';
      if (!PRIORITY_OPTIONS.includes(lead.priority)) lead.priority = 'Média';
      if (!lead.sellerId) lead.sellerId = state.activeSellerId;
      if (phone) seenPhones.add(phone);
      return { line: index + 2, lead, errors };
    });
  }

  function renderImportPreview() {
    const valid = state.pendingImport.filter((item) => !item.errors.length).length;
    const invalid = state.pendingImport.length - valid;
    elements.importSummary.replaceChildren();
    [['Total', state.pendingImport.length], ['Válidos', valid], ['Com erro', invalid]].forEach(([label, value]) => {
      const pill = document.createElement('span');
      pill.textContent = `${label}: ${value}`;
      elements.importSummary.appendChild(pill);
    });
    elements.importPreviewBody.replaceChildren();
    state.pendingImport.slice(0, 80).forEach((item) => {
      const row = document.createElement('tr');
      row.append(
        createTextCell(item.line),
        createTextCell(item.lead.company || '-'),
        createTextCell(item.lead.phone || '-'),
        createTextCell(item.lead.status || 'Pendente'),
        createTextCell(item.errors.length ? item.errors.join('; ') : 'OK')
      );
      elements.importPreviewBody.appendChild(row);
    });
  }

  function confirmImport() {
    const validLeads = state.pendingImport.filter((item) => !item.errors.length).map((item) => item.lead);
    if (!validLeads.length) return showToast('Não há linhas válidas para importar.');
    state.leads = [...validLeads, ...state.leads];
    state.pendingImport = [];
    persistAll();
    render();
    elements.importDialog.close();
    showToast(`${validLeads.length} lead(s) importado(s).`);
  }

  function parseCsv(csvText) {
    const delimiter = detectCsvDelimiter(csvText);
    const rows = readCsvRows(csvText.replace(/^\uFEFF/, ''), delimiter);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header) => normalizeText(header).trim());
    return rows.slice(1).map((row) => {
      const get = (names, fallbackIndex) => {
        const list = Array.isArray(names) ? names : [names];
        const index = headers.findIndex((header) => list.map(normalizeText).includes(header));
        return (index >= 0 ? row[index] : row[fallbackIndex]) || '';
      };
      const sellerName = get(['Representante', 'Vendedor'], 6).trim();
      const seller = getOrCreateSellerByName(sellerName);
      return {
        id: createId('lead'),
        company: get('Empresa', 0).trim(),
        city: get('Cidade', 1).trim(),
        state: get('Estado', 2).trim().toUpperCase(),
        phone: get('Telefone', 3).trim(),
        whatsapp: get('WhatsApp', 4).trim(),
        buyer: get(['Comprador', 'Responsável', 'Responsavel'], 5).trim(),
        sellerId: seller.id,
        priority: normalizePriority(get('Prioridade', 7)),
        status: normalizeStatus(get('Status', 8)),
        returnAt: normalizeImportDateTime(get(['Retorno', 'Retorno agendado'], 9)),
        lastPurchaseDate: get(['Última compra', 'Ultima compra'], 10).trim(),
        lastPurchaseValue: normalizeMoney(get(['Valor última compra', 'Valor ultima compra'], 11)),
        notes: get(['Observações', 'Observacoes'], 12).trim(),
        internalNotes: get(['Observações internas', 'Observacoes internas'], 13).trim(),
        callSummary: '',
        contacts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  }

  function getOrCreateSellerByName(name) {
    if (!name) return findSeller(state.activeSellerId) || state.sellers[0];
    const existing = state.sellers.find((seller) => normalizeText(seller.name) === normalizeText(name));
    if (existing) return existing;
    const seller = { id: createId('seller'), name, contact: '', createdAt: new Date().toISOString() };
    state.sellers.push(seller);
    storageService.save(SELLERS_KEY, state.sellers);
    return seller;
  }

  function clearBase() {
    if (!state.leads.length) return showToast('A base já está vazia.');
    if (!confirm('Tem certeza que deseja apagar todos os leads e históricos? Esta ação não pode ser desfeita.')) return;
    state.leads = [];
    persistAll();
    resetLeadForm();
    render();
    showToast('Base limpa.');
  }

  function copyScript() {
    const script = elements.salesScript.textContent;
    if (!navigator.clipboard) return showToast('Copie o roteiro manualmente neste navegador.');
    navigator.clipboard.writeText(script).then(() => showToast('Roteiro copiado.')).catch(() => showToast('Não foi possível copiar automaticamente.'));
  }

  function countByStatus(status) {
    return state.leads.filter((lead) => lead.status === status).length;
  }

  function findLead(id) {
    return state.leads.find((lead) => lead.id === id);
  }

  function findSeller(id) {
    return state.sellers.find((seller) => seller.id === id);
  }

  function getSellerName(id) {
    return findSeller(id)?.name || 'Sem representante';
  }

  function isReturnOverdue(lead) {
    return Boolean(lead.returnAt && new Date(lead.returnAt) < new Date() && lead.status !== 'Convertido');
  }

  function returnTimeValue(lead) {
    return lead.returnAt ? new Date(lead.returnAt).getTime() : Number.MAX_SAFE_INTEGER;
  }

  function classifySummary(summary) {
    const normalized = normalizeText(summary);
    if (coldWords.some((word) => normalized.includes(normalizeText(word)))) return 'Frio';
    if (hotWords.some((word) => normalized.includes(normalizeText(word)))) return 'Quente';
    if (warmWords.some((word) => normalized.includes(normalizeText(word)))) return 'Morno';
    return 'Pendente';
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function cleanPhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function normalizeText(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeStatus(status) {
    const normalized = normalizeText(status).trim();
    return STATUS_OPTIONS.find((option) => normalizeText(option) === normalized) || 'Pendente';
  }

  function normalizePriority(priority) {
    const normalized = normalizeText(priority).trim();
    return PRIORITY_OPTIONS.find((option) => normalizeText(option) === normalized) || 'Média';
  }

  function normalizeMoney(value) {
    return String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  }

  function normalizeImportDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (!match) return '';
    return `${match[3]}-${match[2]}-${match[1]}T${match[4] || '09'}:${match[5] || '00'}`;
  }

  function detectCsvDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/)[0] || '';
    return (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  }

  function readCsvRows(text, delimiter) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const nextChar = text[index + 1];
      if (char === '"' && quoted && nextChar === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && nextChar === '\n') index += 1;
        row.push(value);
        if (row.some((cell) => cell.trim() !== '')) rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }
    row.push(value);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    return rows;
  }

  function escapeCsvValue(value) {
    return `"${String(value || '').replace(/"/g, '""')}"`;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function toDateTimeLocal(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadBlob(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    toastTimer = setTimeout(() => elements.toast.classList.add('hidden'), 3200);
  }

  function exposeIntegrationSurface() {
    window.BlascorApp = {
      version: VERSION,
      services: { storage: storageService, dialer: dialerService },
      adapters: { protheus: protheusAdapter },
      getState: () => JSON.parse(JSON.stringify(state))
    };
    window.getFutureMicroSipCommand = dialerService.getMicroSipCommand;
  }

  init();
})();
