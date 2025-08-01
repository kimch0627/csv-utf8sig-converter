document.addEventListener('DOMContentLoaded', async () => {
  // 버전 정보 표시
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('versionInfo');
  if (versionElement) {
    versionElement.textContent = manifest.version;
  }
  
  // 설정 로드
  await loadSettings();
  
  // 최근 다운로드 정보 표시
  await checkRecentDownload();
  
  // 이벤트 리스너 설정
  setupEventListeners();
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(['autoNotify', 'showNotifications']);
  
  document.getElementById('miniAutoNotify').checked = settings.autoNotify !== false;
  document.getElementById('miniShowNotifications').checked = settings.showNotifications === true;
  
  // 상태 카드 업데이트
  updateStatusCard(settings.autoNotify !== false);
}

async function checkRecentDownload() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECENT_DOWNLOAD' });
    
    if (response && response.filename) {
      const now = Date.now();
      const downloadTime = response.timestamp;
      
      // 30분 이내의 다운로드만 표시
      if (now - downloadTime < 30 * 60 * 1000) {
        const recentFileInfo = document.getElementById('recentFileInfo');
        const recentFileName = document.getElementById('recentFileName');
        const recentTime = document.getElementById('recentTime');
        
        recentFileInfo.style.display = 'block';
        recentFileName.textContent = response.filename;
        
        // 시간 표시
        const minutes = Math.floor((now - downloadTime) / 60000);
        if (minutes < 1) {
          recentTime.textContent = ' (방금 전)';
        } else {
          recentTime.textContent = ` (${minutes}분 전)`;
        }
      }
    }
  } catch (error) {
    console.error('Failed to get recent download:', error);
  }
}

function updateStatusCard(isEnabled) {
  const statusCard = document.querySelector('.status-card');
  const statusIcon = statusCard.querySelector('.status-icon');
  const statusTitle = statusCard.querySelector('.status-title');
  const statusDesc = statusCard.querySelector('.status-desc');
  
  if (isEnabled) {
    statusIcon.textContent = '✅';
    statusTitle.textContent = '자동 감지 활성화';
    statusDesc.textContent = 'CSV 다운로드 시 자동으로 변환기가 열립니다';
    statusCard.style.background = '#e8f5e8';
    statusCard.style.borderColor = '#c3e6c3';
  } else {
    statusIcon.textContent = '⏸️';
    statusTitle.textContent = '자동 감지 비활성화';
    statusDesc.textContent = '수동으로 변환기를 열어야 합니다';
    statusCard.style.background = '#f5f5f5';
    statusCard.style.borderColor = '#e0e0e0';
  }
}

function setupEventListeners() {
  // 변환기 열기 버튼
  document.getElementById('openConverterBtn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html'),
      active: true
    });
    window.close();
  });
  
  // 파일 선택 버튼 (변환기를 열고 파일 선택 UI로 포커스)
  document.getElementById('selectFileBtn').addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html#select-file'),
      active: true
    });
    window.close();
  });
  
  // 상세 설정 링크
  document.getElementById('openSettingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html#settings'),
      active: true
    });
    window.close();
  });
  
  // 자동 탭 열기 설정
  document.getElementById('miniAutoNotify').addEventListener('change', async (e) => {
    const checked = e.target.checked;
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { autoNotify: checked }
    });
    updateStatusCard(checked);
  });
  
  // 알림 설정
  document.getElementById('miniShowNotifications').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { showNotifications: e.target.checked }
    });
  });
}