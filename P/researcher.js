// ==========================================================
// ==   نسخه حرفه‌ای و نهایی جاوا اسکریپت پنل محققین (Researcher Panel)   ==
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- State & Config ---
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwTgJU4lbocweggC0zU7XyzzWKg3BhcUcFc5kaeYoD6dsAHVN7A-15L19G32UCa2hB/exec';
    let appState = {
        currentUser: null,
        articles: []
    };
    
    // --- DOM Elements ---
    const loginPage = document.getElementById('login-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const loginForm = document.getElementById('login-form');
    const modalContainer = document.getElementById('modal-container');
    const articlesContainer = document.getElementById('articles-container');
    const dashboardContent = document.getElementById('dashboard-content');
    const dashboardPlaceholder = document.getElementById('dashboard-content-placeholder');

    // --- Core Functions ---
    async function callApi(action, params = {}, button = null) {
        if (button) button.classList.add('btn-loading');
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, params })
            });
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error('API Call Failed:', error);
            showCustomAlert('خطا در ارتباط با سرور.', 'error');
            return { status: 'error', message: error.message };
        } finally {
            if (button) button.classList.remove('btn-loading');
        }
    }

    // --- Authentication ---
    function storeUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        appState.currentUser = user;
    }
    function getStoredUser() {
        if (appState.currentUser) return appState.currentUser;
        const user = localStorage.getItem('currentUser');
        if (user) {
            appState.currentUser = JSON.parse(user);
            return appState.currentUser;
        }
        return null;
    }
    
    async function handleLogin(e) {
        e.preventDefault();
        const loginError = document.getElementById('login-error');
        loginError.textContent = '';
        const response = await callApi('login', {
            nationalId: document.getElementById('national-id').value,
            password: document.getElementById('password').value
        }, document.getElementById('login-btn'));
        if (response?.status === 'success') {
            storeUser(response.user);
            showDashboard(response.user);
        } else {
            loginError.textContent = response?.message || 'خطایی رخ داد.';
        }
    }
    
    function handleLogout() {
        localStorage.removeItem('currentUser');
        appState.currentUser = null;
        window.location.reload();
    }
    
    // --- Dashboard & Articles ---
    async function showDashboard(user) {
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
        document.getElementById('menu-user-name').textContent = user.name;
        document.getElementById('menu-user-nid').textContent = `کد ملی: ${user.nationalId}`;
        document.getElementById('menu-user-score').textContent = user.score;
        await loadArticles(user.nationalId);
    }

    async function loadArticles(nationalId, showLoader = true) {
        if(showLoader) {
            dashboardContent.classList.add('hidden');
            dashboardPlaceholder.classList.remove('hidden');
        }
        const response = await callApi('getArticles', { nationalId });
        if(showLoader) {
            dashboardPlaceholder.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
        }

        if (response?.status === 'success') {
            appState.articles = response.articles;
            renderArticles(appState.articles);
            if(response.score !== undefined) {
                 document.getElementById('menu-user-score').textContent = response.score;
                 const user = getStoredUser();
                 user.score = response.score;
                 storeUser(user);
            }
        }
    }

    function renderArticles(articles) {
        const rejected = articles.filter(a => a.articleStatus === 0 || a.articleStatus === '0');
        const accepted = articles.filter(a => a.articleStatus === 5 || a.articleStatus === '5');
        const inProgress = articles.filter(a => a.articleStatus !== 0 && a.articleStatus !== '0' && a.articleStatus !== 5 && a.articleStatus !== '5');
        
        articlesContainer.innerHTML = '';
        renderGroup('مقالات در حال پیگیری', inProgress, articlesContainer);
        renderGroup('مقالات پذیرفته شده', accepted, articlesContainer);
        renderGroup('مقالات رد شده', rejected, articlesContainer);
        
        if(articles.length === 0) {
             articlesContainer.innerHTML = '<p>شما هنوز مقاله‌ای ثبت نکرده‌اید.</p>';
        }
        
        document.getElementById('add-new-article-btn').disabled = articles.some(a => a.articleStatus == 1 || a.articleStatus == 2);
    }
    
    function renderGroup(title, articles, container) {
        if (articles.length === 0) return;
        const groupTitle = document.createElement('h4');
        groupTitle.className = 'article-group-title';
        groupTitle.textContent = title;
        container.appendChild(groupTitle);
        articles.forEach(article => container.appendChild(createArticleCard(article)));
    }

    function createArticleCard(article) {
        let supervisorStatusText, supervisorStatusColor;
        if (article.supervisorStatus == 5) { supervisorStatusText = `راهنما: ${article.supervisorName}`; supervisorStatusColor = '#198754'; } 
        else if (article.supervisorStatus == 1) { supervisorStatusText = 'بررسی پذیرش توسط استاد'; supervisorStatusColor = '#ffc107'; } 
        else if (article.supervisorStatus == 0) { supervisorStatusText = 'نپذیرفته'; supervisorStatusColor = '#dc3545'; } 
        else { supervisorStatusText = 'نامشخص'; supervisorStatusColor = '#6c757d'; }

        const [articleStatusText, articleStatusColor] = getStatusInfo('article', article.articleStatus);
        const canBeDeleted = article.supervisorStatus != 5;
        const cardBorderColor = (article.articleStatus == 5 || article.articleStatus == 0 || article.articleStatus == 4) ? articleStatusColor : supervisorStatusColor;
        const isReadOnly = article.articleStatus == 5 || article.articleStatus == 6 || article.articleStatus == 8;

        const card = document.createElement('div');
        card.className = 'article-card';
        card.style.borderTopColor = cardBorderColor;
        card.dataset.articleId = article.articleId;

        let editorFeedbackHTML = '';
        if ((article.articleStatus == 2 || article.articleStatus == 0) && article.rejectionReason) {
            const noticeClass = article.articleStatus == 0 ? 'editor-feedback-notice rejected' : 'editor-feedback-notice';
            editorFeedbackHTML = `<div class="${noticeClass}"><strong>توضیحات:</strong> ${article.rejectionReason}</div>`;
        }

        let supervisorCancellationNotice = '';
        if (article.articleStatus == 4) {
            supervisorCancellationNotice = `<div class="supervisor-cancellation-notice">استاد از بررسی مقاله شما انصراف داده است. لطفاً از بخش ویرایش، استاد راهنمای مقاله را تغییر دهید.</div>`;
        }
        
        const reReviewButtonHTML = article.articleStatus == 2
            ? `<button class="btn-rereview btn-info" data-action="rereview"><i class="fas fa-paper-plane"></i> ارسال جهت بررسی مجدد</button>`
            : '';

        const supervisorRejectionNotice = article.supervisorStatus == 0 ? `<div class="supervisor-rejection-notice">استاد راهنما این درخواست را نپذیرفته است. لطفاً از بخش ویرایش، استاد راهنمای دیگری انتخاب کنید.</div>` : '';
        const requestDateFormatted = article.requestDate ? new Date(article.requestDate).toLocaleDateString('fa-IR') : 'نامشخص';
        const acceptanceDateFormatted = article.acceptanceDate ? new Date(article.acceptanceDate).toLocaleDateString('fa-IR') : 'نامشخص';
        const acceptanceInfo = (article.articleStatus == 5) ? `<div><strong>تاریخ پذیرش:</strong> <span>${acceptanceDateFormatted}</span></div><div><strong>شماره مجله:</strong> <span>${article.issueNumber || 'نامشخص'}</span></div>` : '';

        card.innerHTML = `
            <div class="article-header-clickable" data-action="toggle">
                <div class="article-header">
                    <div class="article-title-wrapper">
                        <span class="article-title">${article.title}</span>
                        <span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>
                    </div>
                    <div class="status-badges">
                        <span class="status-badge" style="background-color: ${supervisorStatusColor};">${supervisorStatusText}</span>
                        <span class="status-badge" style="background-color: ${articleStatusColor};">${articleStatusText}</span>
                    </div>
                </div>
                ${supervisorRejectionNotice} ${supervisorCancellationNotice} ${editorFeedbackHTML}
            </div>
            <div class="collapsible-details">
                <div class="details-grid">
                    <div><strong>ثبت درخواست:</strong> <span>${requestDateFormatted}</span></div>
                    <div><strong>شناسه مقاله:</strong> <span>${article.articleId}</span></div>
                    <div><strong>استاد راهنما:</strong> <span>${article.supervisorName}</span></div>
                    <div><strong>حیطه دانشی:</strong> <span>${article.knowledgeArea || 'نامشخص'}</span></div>
                    ${acceptanceInfo}
                </div>
            </div>
            <div class="article-details">
                <div class="article-actions">
                    ${reReviewButtonHTML}
                    <button class="btn-view" data-action="view">${isReadOnly ? 'مشاهده' : (article.articleStatus == 4 ? 'مشاهده و ویرایش' : 'مشاهده و تکمیل')}</button>
                    ${canBeDeleted ? `<button class="btn-delete btn-danger" title="حذف مقاله" data-action="delete" aria-label="حذف مقاله"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>`;
        
        return card;
    }

    // --- Event Delegation for Article Actions ---
    articlesContainer.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const card = target.closest('.article-card');
        const articleId = card.dataset.articleId;
        
        switch (action) {
            case 'toggle':
                card.classList.toggle('expanded');
                break;
            case 'view':
                const articleToView = appState.articles.find(a => a.articleId == articleId);
                if(articleToView) showEditArticleWizard(articleToView);
                break;
            case 'delete':
                handleDeleteArticle(articleId);
                break;
            case 'rereview':
                handleRequestReReviewClick(articleId);
                break;
        }
    });

    // --- Action Handlers ---
    async function handleRequestReReviewClick(articleId) {
        showCustomConfirm('آیا از ارسال مقاله برای بررسی مجدد اطمینان دارید؟ پس از ارسال، دیگر قادر به ویرایش مقاله نخواهید بود.', async (confirmed) => {
            if (confirmed) {
                const user = getStoredUser();
                const response = await callApi('requestReReview', { articleId, nationalId: user.nationalId });
                if (response?.status === 'success') {
                    showCustomAlert(response.message, 'success');
                    await loadArticles(user.nationalId, false);
                } else {
                    showCustomAlert('خطا در ارسال: ' + (response.message || 'خطای نامشخص'), 'error');
                }
            }
        });
    }

    // The rest of the functions (showEditArticleWizard, modals, helpers, etc.) remain here
    // No changes are made to them from the last provided version with all its features.
    // Omitted for brevity but should be copied from the previous response.
    // ...
    // Place all other helper functions like showEditArticleWizard, showNewArticleModal, 
    // getStatusInfo, etc. here. They are unchanged.

});
