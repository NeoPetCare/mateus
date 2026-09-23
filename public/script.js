const modal = document.querySelector('#donation-modal');
const toast = document.querySelector('.toast');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const navMore = document.querySelector('.nav-more');
const navMoreToggle = document.querySelector('.nav-more-toggle');
const contrastToggle = document.querySelector('.contrast-toggle');
const reportModal = document.querySelector('#report-modal');
const contrastKey = 'neopetcare.contrast.v1';

function closeNavMore() {
  if (!navMore) return;
  navMore.classList.remove('open');
  if (navMoreToggle) navMoreToggle.setAttribute('aria-expanded', 'false');
}

if (navMoreToggle) {
  navMoreToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = navMore.classList.contains('open');
    if (isOpen) {
      closeNavMore();
    } else {
      navMore.classList.add('open');
      navMoreToggle.setAttribute('aria-expanded', 'true');
    }
  });
}

document.addEventListener('click', (event) => {
  const clickedInsideMore = navMore && navMore.contains(event.target);
  if (!clickedInsideMore) closeNavMore();
});

function applyContrastMode(isEnabled) {
  document.body.classList.toggle('contrast-mode', isEnabled);
  if (contrastToggle) {
    contrastToggle.setAttribute('aria-pressed', String(isEnabled));
    contrastToggle.textContent = isEnabled ? '☀ Modo normal' : '◐ Alto contraste';
    contrastToggle.setAttribute('aria-label', isEnabled ? 'Desativar alto contraste' : 'Ativar alto contraste');
  }
  try {
    localStorage.setItem(contrastKey, String(isEnabled));
  } catch (error) {
  }
}

let savedContrastMode = false;
try {
  savedContrastMode = localStorage.getItem(contrastKey) === 'true';
} catch (error) {
  savedContrastMode = false;
}
applyContrastMode(savedContrastMode);

if (contrastToggle) {
  contrastToggle.addEventListener('click', () => {
    const nextState = !document.body.classList.contains('contrast-mode');
    applyContrastMode(nextState);
  });
}
const reportGrid = document.querySelector('#report-grid');
const reportForm = document.querySelector('#report-form');
const isFilePreview = window.location.protocol === 'file:';
const reportStorageKey = 'neopetcare.reports.v1';
let selectedReportPhoto = '';
let selectedReportStatus = 'perdido';
const storageKeys = {
  wikiArticles: 'neopetcare.wiki.articles.v1',
  wikiLikes: 'neopetcare.wiki.likes.v1',
  testimonials: 'neopetcare.testimonials.v1'
};

function readStoredData(key, fallback = []) {
  try {
    const storedData = localStorage.getItem(key);
    const parsedData = storedData ? JSON.parse(storedData) : fallback;
    return Array.isArray(parsedData) ? parsedData : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveStoredData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    showToast('Não foi possível salvar neste navegador.');
    return false;
  }
}

function createClientId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  const { signal, ...requestOptions } = options;
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) },
      ...requestOptions,
      signal: signal || controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.');
    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function createReportPhotoInput() {
  if (!reportForm) return;
  const field = document.createElement('div');
  field.className = 'photo-upload-field';
  const label = document.createElement('label');
  label.textContent = 'Foto do animal (opcional)';
  const input = document.createElement('input');
  const preview = document.createElement('img');
  const removeButton = document.createElement('button');
  input.id = 'report-photo-input';
  input.type = 'file';
  input.name = 'photo';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.setAttribute('aria-describedby', 'report-photo-help');
  const help = document.createElement('small');
  help.id = 'report-photo-help';
  help.textContent = 'JPG, PNG ou WebP. A imagem será otimizada automaticamente.';
  preview.className = 'photo-upload-preview';
  preview.alt = 'Prévia da foto selecionada';
  preview.hidden = true;
  removeButton.type = 'button';
  removeButton.className = 'photo-upload-remove';
  removeButton.textContent = 'Remover foto';
  removeButton.hidden = true;
  input.addEventListener('change', async () => {
    const file = input.files[0];
    selectedReportPhoto = file ? await resizeImage(file) : '';
    if (selectedReportPhoto) {
      preview.src = selectedReportPhoto;
      preview.hidden = false;
      removeButton.hidden = false;
    }
    showToast(selectedReportPhoto ? 'Foto adicionada à ocorrência.' : 'Não foi possível carregar a foto.');
  });
  removeButton.addEventListener('click', () => {
    input.value = '';
    selectedReportPhoto = '';
    preview.removeAttribute('src');
    preview.hidden = true;
    removeButton.hidden = true;
  });
  label.append(input, help);
  field.append(label, preview, removeButton);
  reportForm.querySelector('.full-button').before(field);
}

async function resizeImage(file) {
  try {
    const image = window.createImageBitmap ? await createImageBitmap(file) : await loadImage(file);
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();
    return canvas.toDataURL('image/jpeg', .78);
  } catch (error) {
    return '';
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

createReportPhotoInput();

function readStoredMap(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    return {};
  }
}

function saveStoredMap(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast('Não foi possível salvar a foto neste navegador.');
    return false;
  }
}

function addCardPhotoUploads(selector, storageKey, labelText) {
  const photos = readStoredMap(storageKey);
  document.querySelectorAll(selector).forEach((card, index) => {
    const image = card.querySelector(selector === '.pet-card' ? '.pet-image' : '.campaign-image');
    if (!image) return;
    const key = String(index);
    if (photos[key]) image.style.backgroundImage = `url("${photos[key]}")`;
    const field = document.createElement('label');
    field.className = 'card-photo-upload';
    field.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', `${labelText} ${index + 1}`);
    input.addEventListener('change', async () => {
      const photo = input.files[0] ? await resizeImage(input.files[0]) : '';
      if (!photo) return showToast('Não foi possível carregar a foto.');
      photos[key] = photo;
      if (!saveStoredMap(storageKey, photos)) return;
      image.style.backgroundImage = `url("${photo}")`;
      showToast('Foto atualizada e armazenada como backup.');
    });
    field.append(input);
    const content = card.querySelector('.card-content') || card.querySelector(':scope > div:last-child');
    if (content && selector === '.campaign') {
      content.querySelector('h3')?.after(field);
    } else if (content) {
      content.prepend(field);
    } else {
      card.append(field);
    }
  });
}

addCardPhotoUploads('.pet-card', 'neopetcare.pet-photos.v1', 'Trocar foto');
addCardPhotoUploads('.campaign', 'neopetcare.campaign-photos.v1', 'Trocar foto');

function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('.open-donation').forEach((button) => button.addEventListener('click', openModal));
document.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

document.querySelectorAll('.amounts button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.amounts button').forEach((item) => item.classList.remove('selected'));
    button.classList.add('selected');
  });
});

document.querySelector('.full-button').addEventListener('click', () => {
  closeModal();
  showToast('Obrigado por fazer parte dessa transformação. ♥');
});

const adoptionModal = document.querySelector('#adoption-modal');
const adoptionForm = document.querySelector('#adoption-form');
const adoptionPetName = document.querySelector('#adoption-pet-name');
const adoptionPetInput = document.querySelector('#adoption-pet-input');
function closeAdoptionModal() {
  adoptionModal.classList.remove('open');
  adoptionModal.setAttribute('aria-hidden', 'true');
}
document.querySelectorAll('.adoption-button').forEach((button) => button.addEventListener('click', () => {
  adoptionPetName.textContent = button.dataset.pet;
  adoptionPetInput.value = button.dataset.pet;
  adoptionModal.classList.add('open');
  adoptionModal.setAttribute('aria-hidden', 'false');
}));
document.querySelector('.adoption-modal-close').addEventListener('click', closeAdoptionModal);
adoptionModal.addEventListener('click', (event) => {
  if (event.target === adoptionModal) closeAdoptionModal();
});
adoptionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const interest = Object.fromEntries(new FormData(adoptionForm));
  try {
    await apiRequest('/api/adoptions', { method: 'POST', body: JSON.stringify(interest) });
    adoptionForm.reset();
    closeAdoptionModal();
    showToast(`Interesse por ${interest.pet} recebido. Obrigado!`);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll('.favorite').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('saved');
    button.textContent = button.classList.contains('saved') ? '♥' : '♡';
  });
});

document.querySelectorAll('.filter').forEach((filter) => {
  filter.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'));
    filter.classList.add('active');
    const selected = filter.dataset.filter;
    document.querySelectorAll('.pet-card').forEach((card) => {
      card.classList.toggle('is-hidden', selected !== 'todos' && !card.dataset.type.includes(selected));
    });
  });
});

document.querySelector('.newsletter').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = new FormData(event.currentTarget).get('email');
  try {
    await apiRequest('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) });
    event.currentTarget.reset();
    showToast('E-mail cadastrado. Obrigado por acompanhar a NeoPetCare!');
  } catch (error) {
    showToast(error.message);
  }
});

const authForm = document.querySelector('#auth-form');
const authTabs = [...document.querySelectorAll('.auth-tab')];
const authNameField = document.querySelector('.auth-name-field');
const authSubmit = authForm ? authForm.querySelector('button[type="submit"]') : null;
let authMode = 'login';
function updateAuthMode(mode) {
  authMode = mode;
  authTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.authTab === mode));
  authNameField.hidden = mode !== 'signup';
  authNameField.querySelector('input').required = mode === 'signup';
  authForm.elements.password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  authSubmit.textContent = mode === 'signup' ? 'Criar minha conta →' : 'Entrar na minha conta →';
}
authTabs.forEach((tab) => tab.addEventListener('click', () => updateAuthMode(tab.dataset.authTab)));
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(authForm));
  try {
    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(data) });
    authForm.reset();
    updateAuthMode('login');
    showToast(`Olá, ${result.user.name}! Acesso realizado com segurança.`);
  } catch (error) {
    showToast(error.message);
  }
});

const testimonials = [...document.querySelectorAll('.testimonial')];
const testimonialDots = [...document.querySelectorAll('.testimonial-dot')];
let activeTestimonial = 0;
const testimonialForm = document.querySelector('#testimonial-form');
const testimonialModal = document.querySelector('#testimonial-modal');
function showTestimonial(index) {
  activeTestimonial = (index + testimonials.length) % testimonials.length;
  testimonials.forEach((testimonial, testimonialIndex) => testimonial.classList.toggle('active', testimonialIndex === activeTestimonial));
  testimonialDots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === activeTestimonial));
}
function openTestimonialEditor() {
  const current = testimonials[activeTestimonial];
  testimonialForm.elements.name.value = current.querySelector('.testimonial-person strong').textContent;
  testimonialForm.elements.role.value = current.querySelector('.testimonial-person small').textContent;
  testimonialForm.elements.text.value = current.querySelector('p').textContent;
  testimonialModal.classList.add('open');
  testimonialModal.setAttribute('aria-hidden', 'false');
}
function closeTestimonialEditor() {
  testimonialModal.classList.remove('open');
  testimonialModal.setAttribute('aria-hidden', 'true');
}
document.querySelector('.open-testimonial-form').addEventListener('click', openTestimonialEditor);
document.querySelector('.testimonial-modal-close').addEventListener('click', closeTestimonialEditor);
testimonialModal.addEventListener('click', (event) => {
  if (event.target === testimonialModal) closeTestimonialEditor();
});
testimonialForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(testimonialForm));
  const current = testimonials[activeTestimonial];
  current.querySelector('p').textContent = data.text;
  current.querySelector('.testimonial-person strong').textContent = data.name;
  current.querySelector('.testimonial-person small').textContent = data.role;
  const savedTestimonials = readStoredData(storageKeys.testimonials);
  savedTestimonials[activeTestimonial] = data;
  saveStoredData(storageKeys.testimonials, savedTestimonials);
  closeTestimonialEditor();
  showToast('Depoimento atualizado com sucesso.');
});
const savedTestimonials = readStoredData(storageKeys.testimonials);
savedTestimonials.forEach((saved, index) => {
  if (!testimonials[index]) return;
  testimonials[index].querySelector('p').textContent = saved.text;
  testimonials[index].querySelector('.testimonial-person strong').textContent = saved.name;
  testimonials[index].querySelector('.testimonial-person small').textContent = saved.role;
});
document.querySelector('.testimonial-prev').addEventListener('click', () => showTestimonial(activeTestimonial - 1));
document.querySelector('.testimonial-next').addEventListener('click', () => showTestimonial(activeTestimonial + 1));
testimonialDots.forEach((dot, dotIndex) => dot.addEventListener('click', () => showTestimonial(dotIndex)));

const wikiModal = document.querySelector('#wiki-modal');
const wikiForm = document.querySelector('#wiki-form');
const wikiGrid = document.querySelector('#wiki-grid');
const wikiSearch = document.querySelector('#wiki-search');
let activeWikiCategory = 'todos';

function closeWikiModal() {
  wikiModal.classList.remove('open');
  wikiModal.setAttribute('aria-hidden', 'true');
}

document.querySelector('.open-wiki-form').addEventListener('click', () => {
  wikiModal.classList.add('open');
  wikiModal.setAttribute('aria-hidden', 'false');
});
document.querySelector('.wiki-modal-close').addEventListener('click', closeWikiModal);
wikiModal.addEventListener('click', (event) => {
  if (event.target === wikiModal) closeWikiModal();
});

function filterWiki() {
  const search = wikiSearch.value.toLowerCase().trim();
  let visibleArticles = 0;
  document.querySelectorAll('.wiki-card').forEach((card) => {
    const matchesCategory = activeWikiCategory === 'todos' || card.dataset.category === activeWikiCategory;
    const matchesSearch = card.dataset.search.includes(search);
    const visible = matchesCategory && matchesSearch;
    card.hidden = !visible;
    if (visible) visibleArticles += 1;
  });
  document.querySelector('#wiki-empty').classList.toggle('visible', visibleArticles === 0);
}

document.querySelectorAll('.wiki-filter').forEach((filter) => filter.addEventListener('click', () => {
  document.querySelectorAll('.wiki-filter').forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
  activeWikiCategory = filter.dataset.category;
  filterWiki();
}));
wikiSearch.addEventListener('input', filterWiki);

const rightsArticle = document.querySelector('.wiki-card[data-category="direitos"]');
if (rightsArticle) {
  rightsArticle.dataset.search += ' preços preco valores custos';
  const priceGuide = document.createElement('div');
  priceGuide.className = 'wiki-price-guide';
  priceGuide.innerHTML = '<strong>Valores de referência</strong><span>Consulta veterinária: R$ 80 a R$ 250</span><span>Denúncia e orientação: gratuita</span>';
  rightsArticle.querySelector('.wiki-meta').before(priceGuide);
}

function createWikiCard(article) {
  const categoryNames = { saude: 'Saúde', cuidados: 'Cuidados', adocao: 'Adoção', direitos: 'Direitos' };
  const card = document.createElement('article');
  card.className = 'wiki-card';
  card.dataset.category = article.category;
  card.dataset.search = `${article.title} ${article.summary} ${categoryNames[article.category]}`.toLowerCase();
  const categoryName = categoryNames[article.category] || 'Cuidados';
  card.innerHTML = `<span class="wiki-category">${categoryName}</span><h3>${escapeHtml(article.title)}</h3><p>${escapeHtml(article.summary)}</p><div class="wiki-meta"><span>Por ${escapeHtml(article.author)}</span><button class="wiki-like" data-article="${escapeHtml(article.id)}">♡ <b>0</b></button></div>`;
  wikiGrid.prepend(card);
}

readStoredData(storageKeys.wikiArticles).forEach(createWikiCard);
filterWiki();

document.addEventListener('click', (event) => {
  const likeButton = event.target.closest('.wiki-like');
  if (!likeButton) return;
  const likedArticles = readStoredData(storageKeys.wikiLikes);
  const articleId = likeButton.dataset.article;
  const isLiked = likedArticles.includes(articleId);
  const count = Number(likeButton.querySelector('b').textContent);
  likeButton.querySelector('b').textContent = isLiked ? Math.max(0, count - 1) : count + 1;
  likeButton.firstChild.textContent = isLiked ? '♡ ' : '♥ ';
  likeButton.classList.toggle('liked', !isLiked);
  saveStoredData(storageKeys.wikiLikes, isLiked ? likedArticles.filter((id) => id !== articleId) : [...likedArticles, articleId]);
});

wikiForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const article = Object.fromEntries(new FormData(wikiForm));
  article.id = `article-${Date.now()}`;
  const articles = readStoredData(storageKeys.wikiArticles);
  articles.push(article);
  saveStoredData(storageKeys.wikiArticles, articles);
  createWikiCard(article);
  wikiForm.reset();
  closeWikiModal();
  filterWiki();
  showToast('Artigo publicado na WikiPet. Obrigado por contribuir!');
});

const partnerForm = document.querySelector('#partner-form');
const partnerList = document.querySelector('#partner-list');
const partnerReviewCount = document.querySelector('#partner-review-count');
const partnerApprovedCount = document.querySelector('#partner-approved-count');
const partnerWhatsAppNumber = '5511999999999';
const partnerStorageKey = 'neopetcare.partners.v1';
const partnerAnalysisMessage = 'Olá! Obrigado pelo interesse em se tornar parceiro da NeoPetCare. Seu cadastro está em análise. Assim que possível, retornaremos a sua solicitação.';
const partnerWhatsAppButton = document.createElement('a');
partnerWhatsAppButton.className = 'whatsapp-inline partner-whatsapp-link';
partnerWhatsAppButton.href = `https://wa.me/${partnerWhatsAppNumber}?text=${encodeURIComponent(partnerAnalysisMessage)}`;
partnerWhatsAppButton.target = '_blank';
partnerWhatsAppButton.rel = 'noopener';
partnerWhatsAppButton.textContent = '◉ Enviar WhatsApp';

function normalizePartnerStatus(partner) {
  const status = partner.status === 'aprovado' ? 'aprovado' : 'em-analise';
  return {
    ...partner,
    id: partner.id || createClientId(),
    status,
    createdAt: partner.createdAt || new Date().toISOString()
  };
}

function backupPartner(partner) {
  const storedPartners = readStoredData(partnerStorageKey);
  storedPartners.push(normalizePartnerStatus(partner));
  return saveStoredData(partnerStorageKey, storedPartners);
}

async function renderPartnerList() {
  const backupPartners = readStoredData(partnerStorageKey).map(normalizePartnerStatus);
  let partners = backupPartners;
  if (isFilePreview) {
    partners = backupPartners;
  } else {
    try {
      partners = (await apiRequest('/api/partners')).partners.map(normalizePartnerStatus);
    } catch (error) {
      partners = backupPartners;
    }
  }
  const reviewCount = partners.filter((partner) => partner.status === 'em-analise').length;
  const approvedCount = partners.filter((partner) => partner.status === 'aprovado').length;

  if (partnerReviewCount) partnerReviewCount.textContent = reviewCount;
  if (partnerApprovedCount) partnerApprovedCount.textContent = approvedCount;

  if (!partnerList) return;
  if (!partners.length) {
    partnerList.innerHTML = '<div class="partner-empty">Ainda não há cadastros de parceiros.</div>';
    return;
  }

  partnerList.innerHTML = partners
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((partner) => {
      const statusText = partner.status === 'aprovado' ? 'Cadastro aprovado' : 'Cadastro em análise';
      const statusClass = partner.status === 'aprovado' ? 'approved' : 'reviewing';
      return `
        <div class="partner-item">
          <div class="partner-item-content">
            <strong>${escapeHtml(partner.organization || 'Parceiro')}</strong>
            <small>${escapeHtml(partner.partnerType || 'Parceiro')} · ${escapeHtml(partner.location || 'Local não informado')}</small>
          </div>
          <div class="partner-item-actions">
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

document.querySelectorAll('[data-partner-type]').forEach((link) => link.addEventListener('click', () => {
  partnerForm.elements.partnerType.value = link.dataset.partnerType;
}));
partnerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const partner = Object.fromEntries(new FormData(partnerForm));
  const whatsappWindow = window.open('about:blank', '_blank');
  try {
    if (isFilePreview) {
      backupPartner(partner);
    } else {
      await apiRequest('/api/partners', { method: 'POST', body: JSON.stringify(partner) });
      backupPartner(partner);
    }
    partnerForm.reset();
    await renderPartnerList();

    const whatsappUrl = `https://wa.me/${partnerWhatsAppNumber}?text=${encodeURIComponent(partnerAnalysisMessage)}`;
    if (whatsappWindow) {
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }

    if (partnerList) {
      partnerList.insertAdjacentHTML('afterend', '<div class="partner-whatsapp-copy">Mensagem pronta para contato: "Olá! Obrigado pelo interesse em se tornar parceiro da NeoPetCare. Seu cadastro está em análise. Assim que possível, retornaremos a sua solicitação."</div>');
    }
    showToast('Cadastro enviado. A mensagem foi preparada no WhatsApp.');
  } catch (error) {
    showToast(error.message);
  }
});

renderPartnerList();
menuToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Abrir menu');
}));

function closeReportModal() {
  reportModal.classList.remove('open');
  reportModal.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('.open-report').forEach((button) => button.addEventListener('click', () => {
  reportModal.classList.add('open');
  reportModal.setAttribute('aria-hidden', 'false');
}));
document.querySelector('.report-modal-close').addEventListener('click', closeReportModal);
reportModal.addEventListener('click', (event) => {
  if (event.target === reportModal) closeReportModal();
});
document.querySelectorAll('.report-type-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.report-type-button').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  selectedReportStatus = button.dataset.reportType;
}));

function filterReports() {
  const search = document.querySelector('#lost-found-search').value.toLowerCase().trim();
  let visibleReports = 0;
  document.querySelectorAll('.report-card').forEach((card) => {
    const matchesStatus = document.querySelector('.lost-filter.active').dataset.status === 'todos' || card.dataset.status === document.querySelector('.lost-filter.active').dataset.status;
    const matchesSearch = card.dataset.search.includes(search);
    const visible = matchesStatus && matchesSearch;
    card.hidden = !visible;
    if (visible) visibleReports += 1;
  });
  document.querySelector('#empty-reports').classList.toggle('visible', visibleReports === 0);
}

function renderStoredReport(report) {
  const statusLabel = report.status === 'perdido' ? 'Perdido' : 'Encontrado';
  const statusClass = report.status === 'perdido' ? 'status-lost' : 'status-found';
  const card = document.createElement('article');
  card.className = 'report-card';
  card.dataset.status = report.status;
  card.dataset.search = `${report.name} ${report.animal} ${report.location} ${report.description}`.toLowerCase();
  const photo = report.photo ? `<img class="report-photo-image" src="${escapeHtml(report.photo)}" alt="Foto de ${escapeHtml(report.name)}" />` : '';
  card.innerHTML = `<div class="report-photo report-new">${photo}<span class="report-status ${statusClass}">${statusLabel}</span></div><div class="report-body"><div><h3>${escapeHtml(report.name)} <small>${escapeHtml(report.animal)}</small></h3><p>${escapeHtml(report.location)}</p></div><span class="report-date">${escapeHtml(report.dateLabel || 'agora')}</span><p class="report-description">${escapeHtml(report.description)}</p></div>`;
  reportGrid.prepend(card);
}

async function loadReports() {
  if (isFilePreview) {
    readStoredData(reportStorageKey).forEach(renderStoredReport);
    filterReports();
    return;
  }
  try {
    const result = await apiRequest('/api/reports');
    result.reports.forEach(renderStoredReport);
  } catch (error) {
  }
  filterReports();
}

loadReports();

document.querySelector('#lost-found-search').addEventListener('input', filterReports);
document.querySelectorAll('.lost-filter').forEach((filter) => filter.addEventListener('click', () => {
  document.querySelectorAll('.lost-filter').forEach((item) => item.classList.remove('active'));
  filter.classList.add('active');
  filterReports();
}));

reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(reportForm);
  const report = {
    status: selectedReportStatus,
    name: data.get('name'),
    animal: data.get('animal'),
    location: data.get('location'),
    description: data.get('description'),
    date: data.get('date'),
    photo: selectedReportPhoto
  };
  try {
    if (isFilePreview) {
      const storedReports = readStoredData(reportStorageKey);
      const savedReport = { ...report, id: createClientId(), dateLabel: 'agora', createdAt: new Date().toISOString() };
      storedReports.push(savedReport);
      if (!saveStoredData(reportStorageKey, storedReports)) return;
      renderStoredReport(savedReport);
    } else {
      const result = await apiRequest('/api/reports', { method: 'POST', body: JSON.stringify(report) });
      renderStoredReport(result.report);
    }
    reportForm.reset();
    selectedReportPhoto = '';
    const photoInput = document.querySelector('#report-photo-input');
    const photoPreview = document.querySelector('.photo-upload-preview');
    const photoRemove = document.querySelector('.photo-upload-remove');
    if (photoInput) photoInput.value = '';
    if (photoPreview) {
      photoPreview.removeAttribute('src');
      photoPreview.hidden = true;
    }
    if (photoRemove) photoRemove.hidden = true;
    closeReportModal();
    filterReports();
    showToast('Ocorrência publicada. A comunidade já pode ajudar.');
  } catch (error) {
    showToast(error.message);
  }
});
