let currentFile = null;
let isAutoSelected = false;

document.addEventListener('DOMContentLoaded', async () => {
  // 뱃지 제거 (페이지가 열렸으므로)
  try {
    chrome.action.setBadgeText({ text: '' });
  } catch (error) {
    console.log('Badge clear failed:', error);
  }
  
  await loadSettings();
  await checkRecentDownload();
  setupEventListeners();
});

async function loadSettings() {
  const settings = await chrome.storage.sync.get(['autoNotify', 'showNotifications']);
  
  document.getElementById('autoNotify').checked = settings.autoNotify !== false;
  document.getElementById('showNotifications').checked = settings.showNotifications !== false;
}

async function checkRecentDownload() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECENT_DOWNLOAD' });
    
    if (response && response.filename) {
      const now = Date.now();
      const downloadTime = response.timestamp;
      
      // 5분 이내의 다운로드만 표시하고 자동 선택
      if (now - downloadTime < 5 * 60 * 1000) {
        // 최근 다운로드 정보 표시
        document.getElementById('recentInfo').style.display = 'block';
        document.getElementById('recentFilename').textContent = response.filename;
        
        // 자동 선택 시뮬레이션
        simulateAutoFileSelection(response.filename);
      }
    }
  } catch (error) {
    console.error('Failed to get recent download:', error);
  }
}

function simulateAutoFileSelection(filename) {
  const fileInputArea = document.getElementById('fileInputArea');
  const convertBtn = document.getElementById('convertBtn');
  const autoSelectLabel = document.getElementById('autoSelectLabel');
  
  // UI를 자동 선택된 상태로 변경
  fileInputArea.classList.add('auto-selected');
  fileInputArea.innerHTML = `
    <input type="file" id="fileInput" accept=".csv">
    <div>🎯 최근 다운로드 파일이 준비되었습니다</div>
    <div class="file-name">${filename}</div>
    <small>클릭하여 파일을 선택하거나 다른 파일을 드래그하세요</small>
  `;
  
  autoSelectLabel.style.display = 'block';
  isAutoSelected = true;
  
  // 파일 input 이벤트 다시 바인딩
  document.getElementById('fileInput').addEventListener('change', handleFileInputChange);
}

function setupEventListeners() {
  // 설정 변경 이벤트
  document.getElementById('autoNotify').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { autoNotify: e.target.checked }
    });
  });
  
  document.getElementById('showNotifications').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { showNotifications: e.target.checked }
    });
  });
  
  // 최근 다운로드 알림 닫기
  document.getElementById('closeRecent').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_DOWNLOAD' });
    document.getElementById('recentInfo').style.display = 'none';
    resetFileSelection();
  });
  
  // 파일 input 이벤트
  document.getElementById('fileInput').addEventListener('change', handleFileInputChange);
  
  // 변환 버튼
  document.getElementById('convertBtn').addEventListener('click', () => {
    if (currentFile) {
      convertFile(currentFile);
    } else if (isAutoSelected) {
      showStatus('파일을 선택해주세요. 위의 파일 선택 영역을 클릭하세요.', 'error');
    } else {
      showStatus('파일을 선택해주세요.', 'error');
    }
  });
  
  // 드래그 앤 드롭 이벤트
  setupDragAndDrop();
}

function handleFileInputChange(e) {
  const file = e.target.files[0];
  handleFileSelection(file);
}

function handleFileSelection(file) {
  const fileInputArea = document.getElementById('fileInputArea');
  const fileNameDiv = document.getElementById('fileName');
  const convertBtn = document.getElementById('convertBtn');
  const autoSelectLabel = document.getElementById('autoSelectLabel');
  
  if (!file) {
    resetFileSelection();
    return;
  }
  
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showStatus('CSV 파일만 지원됩니다.', 'error');
    resetFileSelection();
    return;
  }
  
  // 파일 선택 성공
  currentFile = file;
  isAutoSelected = false;
  
  fileInputArea.classList.remove('auto-selected');
  fileInputArea.classList.add('has-file');
  fileInputArea.innerHTML = `
    <input type="file" id="fileInput" accept=".csv">
    <div>✅ 파일이 선택되었습니다</div>
    <div class="file-name">${file.name}</div>
  `;
  
  convertBtn.disabled = false;
  autoSelectLabel.style.display = 'none';
  
  // 파일 input 이벤트 다시 바인딩
  document.getElementById('fileInput').addEventListener('change', handleFileInputChange);
}

function resetFileSelection() {
  const fileInputArea = document.getElementById('fileInputArea');
  const convertBtn = document.getElementById('convertBtn');
  const autoSelectLabel = document.getElementById('autoSelectLabel');
  
  currentFile = null;
  isAutoSelected = false;
  
  fileInputArea.classList.remove('has-file', 'auto-selected');
  fileInputArea.innerHTML = `
    <input type="file" id="fileInput" accept=".csv">
    <div>CSV 파일을 선택하거나 드래그하세요</div>
  `;
  
  convertBtn.disabled = true;
  autoSelectLabel.style.display = 'none';
  
  // 파일 input 이벤트 다시 바인딩
  document.getElementById('fileInput').addEventListener('change', handleFileInputChange);
}

function setupDragAndDrop() {
  const fileInputArea = document.getElementById('fileInputArea');
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileInputArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    fileInputArea.addEventListener(eventName, () => {
      fileInputArea.classList.add('dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    fileInputArea.addEventListener(eventName, () => {
      fileInputArea.classList.remove('dragover');
    }, false);
  });
  
  fileInputArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      const file = files[0];
      handleFileSelection(file);
      
      // file input에도 파일 설정
      const fileInput = document.getElementById('fileInput');
      fileInput.files = files;
    }
  }, false);
}

async function convertFile(file) {
  const convertBtn = document.getElementById('convertBtn');
  const originalText = convertBtn.textContent;
  
  convertBtn.disabled = true;
  convertBtn.textContent = '변환 중...';
  
  try {
    // 파일 읽기
    const content = await readFileAsText(file);
    
    // 인코딩 확인
    const encoding = checkFileEncoding(content);
    
    if (encoding === 'utf-8-sig') {
      showStatus('이미 UTF-8-sig 형식입니다.', 'info');
      return;
    }
    
    // UTF-8-sig BOM 추가
    const bom = '\uFEFF';
    const utf8SigContent = bom + content;
    
    // 새 파일로 다운로드
    const blob = new Blob([utf8SigContent], { 
      type: 'text/csv;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // 파일명 생성 (중복 접미사 방지)
    let newFileName = file.name.replace('.csv', '_utf8sig.csv');
    if (newFileName.includes('_utf8sig_utf8sig')) {
      newFileName = newFileName.replace('_utf8sig_utf8sig', '_utf8sig');
    }
    
    a.download = newFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus(`✅ 변환 완료! (${encoding} → UTF-8-sig)`, 'success');
    
    // 최근 다운로드 정보 제거
    await chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_DOWNLOAD' });
    document.getElementById('recentInfo').style.display = 'none';
    
    // 변환 완료 알림
    const settings = await chrome.storage.sync.get(['showNotifications']);
    if (settings.showNotifications !== false) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '변환 완료!',
        message: `${newFileName}이 생성되었습니다.`
      });
    }
    
  } catch (error) {
    console.error('변환 중 오류:', error);
    showStatus('❌ 변환 중 오류가 발생했습니다: ' + error.message, 'error');
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = originalText;
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      resolve(e.target.result);
    };
    
    reader.onerror = function() {
      reject(new Error('파일 읽기 실패'));
    };
    
    // UTF-8로 읽기 시도
    reader.readAsText(file, 'UTF-8');
  });
}

function checkFileEncoding(content) {
  // BOM 확인
  if (content.charCodeAt(0) === 0xFEFF) {
    return 'utf-8-sig';
  }
  
  // 간단한 UTF-8 확인
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const encoded = encoder.encode(content);
    decoder.decode(encoded);
    return 'utf-8';
  } catch {
    return 'unknown';
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // 성공 메시지는 더 오래 표시
  const timeout = type === 'success' ? 5000 : 3000;
  setTimeout(() => {
    if (statusDiv.style.display !== 'none') {
      statusDiv.style.display = 'none';
    }
  }, timeout);
}