let currentFile = null;
let isAutoSelected = false;

document.addEventListener('DOMContentLoaded', async () => {
  // 뱃지 제거 (페이지가 열렸으므로)
  try {
    chrome.action.setBadgeText({ text: '' });
  } catch (error) {
    console.log('Badge clear failed:', error);
  }
  
  // 버전 정보 표시
  displayVersionInfo();
  
  await loadSettings();
  await checkRecentDownload();
  setupEventListeners();
});

function displayVersionInfo() {
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement) {
    versionElement.textContent = manifest.version;
  }
  
  // 작성자 정보도 manifest에서 가져오기 (있는 경우)
  const authorElement = document.getElementById('author');
  if (authorElement && manifest.author) {
    // author가 문자열인 경우 이름만 추출
    const authorName = manifest.author.split('<')[0].trim();
    authorElement.textContent = authorName;
  }
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get([
      'autoNotify', 'showNotifications', 'whitelistUrls', 'includeSubdomains'
    ]);
    
    console.log('Loaded settings:', settings);
    
    document.getElementById('autoNotify').checked = settings.autoNotify !== false;
    document.getElementById('showNotifications').checked = settings.showNotifications === true;
    document.getElementById('includeSubdomains').checked = settings.includeSubdomains !== false;
    
    // 화이트리스트 URL 로드
    if (settings.whitelistUrls && Array.isArray(settings.whitelistUrls) && settings.whitelistUrls.length > 0) {
      document.getElementById('whitelistUrls').value = settings.whitelistUrls.join('\n');
    } else {
      // 비어있을 때 플레이스홀더 표시를 위해 빈 값 설정
      document.getElementById('whitelistUrls').value = '';
    }
    
    // 디버깅을 위한 저장소 상태 확인
    chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
      console.log(`Storage used: ${bytesInUse} bytes of ${chrome.storage.sync.QUOTA_BYTES} available`);
    });
  } catch (error) {
    console.error('Settings load error:', error);
    showStatus('⚠️ 설정을 불러오는 중 오류가 발생했습니다.', 'error');
  }
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
  
  // 파일 입력 이벤트 리스너 재설정
  setupFileInputEventListener();
}

function setupFileInputEventListener() {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileSelection(file);
      }
    });
  }
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
  
  // 서브도메인 포함 설정 변경
  document.getElementById('includeSubdomains').addEventListener('change', async (e) => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { includeSubdomains: e.target.checked }
    });
  });
  
  // 화이트리스트 저장 버튼
  document.getElementById('saveWhitelist').addEventListener('click', async () => {
    const saveButton = document.getElementById('saveWhitelist');
    const originalText = saveButton.textContent;
    
    try {
      saveButton.disabled = true;
      saveButton.textContent = '저장 중...';
      
      const rawText = document.getElementById('whitelistUrls').value;
      const urls = rawText
        .split('\n')
        .map(line => {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith('#')) {
            return null;
          }
          return trimmedLine.split('#')[0].trim();
        })
        .filter(url => url && url.length > 0);
      
      // 저장 전 현재 값 백업
      const backup = await chrome.storage.sync.get(['whitelistUrls']);
      
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: { whitelistUrls: urls }
        });
        
        // 저장 확인을 위해 다시 읽어오기
        const saved = await chrome.storage.sync.get(['whitelistUrls']);
        if (JSON.stringify(saved.whitelistUrls) === JSON.stringify(urls)) {
          showStatus('✅ 화이트리스트가 저장되었습니다.', 'success');
          console.log('Whitelist saved successfully:', urls);
        } else {
          throw new Error('저장 확인 실패');
        }
      } catch (error) {
        // 저장 실패 시 백업 복원
        await chrome.storage.sync.set({ whitelistUrls: backup.whitelistUrls || [] });
        throw error;
      }
    } catch (error) {
      console.error('화이트리스트 저장 오류:', error);
      showStatus('❌ 저장 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  });
  
  // 최근 다운로드 알림 닫기
  document.getElementById('closeRecent').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_DOWNLOAD' });
    document.getElementById('recentInfo').style.display = 'none';
    resetFileSelection();
  });
  
  // 변환 버튼
  document.getElementById('convertBtn').addEventListener('click', () => {
    if (currentFile) {
      convertFile(currentFile);
    } else if (isAutoSelected) {
      showStatus('파일을 선택해주세요. 파일 선택 영역을 클릭하세요.', 'error');
    } else {
      showStatus('파일을 선택해주세요.', 'error');
    }
  });
  
  // 파일 입력 영역 클릭 이벤트
  const fileInputArea = document.getElementById('fileInputArea');
  fileInputArea.addEventListener('click', (e) => {
    // input 요소를 클릭한 경우가 아니면 input을 트리거
    if (e.target.tagName !== 'INPUT') {
      const fileInput = document.getElementById('fileInput');
      if (fileInput) {
        fileInput.click();
      }
    }
  });
  
  // 초기 파일 입력 이벤트 리스너 설정
  setupFileInputEventListener();
  
  // 드래그 앤 드롭 이벤트 설정
  setupDragAndDrop();
}

function handleFileSelection(file) {
  const fileInputArea = document.getElementById('fileInputArea');
  const convertBtn = document.getElementById('convertBtn');
  const autoSelectLabel = document.getElementById('autoSelectLabel');
  
  console.log('Handling file selection:', file ? file.name : 'no file');
  
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
  
  fileInputArea.classList.remove('auto-selected', 'dragover');
  fileInputArea.classList.add('has-file');
  fileInputArea.innerHTML = `
    <input type="file" id="fileInput" accept=".csv">
    <div>✅ 파일이 선택되었습니다</div>
    <div class="file-name">${file.name}</div>
    <small>다른 파일로 바꾸려면 클릭하거나 드래그하세요</small>
  `;
  
  convertBtn.disabled = false;
  autoSelectLabel.style.display = 'none';
  
  // 파일 입력 이벤트 리스너 재설정
  setupFileInputEventListener();
  
  console.log('File selection completed:', file.name);
}

function resetFileSelection() {
  const fileInputArea = document.getElementById('fileInputArea');
  const convertBtn = document.getElementById('convertBtn');
  const autoSelectLabel = document.getElementById('autoSelectLabel');
  
  currentFile = null;
  isAutoSelected = false;
  
  fileInputArea.classList.remove('has-file', 'auto-selected', 'dragover');
  fileInputArea.innerHTML = `
    <input type="file" id="fileInput" accept=".csv">
    <div>📄 CSV 파일을 선택하거나 여기로 드래그하세요</div>
  `;
  
  convertBtn.disabled = true;
  autoSelectLabel.style.display = 'none';
  
  // 파일 입력 이벤트 리스너 재설정
  setupFileInputEventListener();
  
  console.log('File selection reset');
}

function setupDragAndDrop() {
  const fileInputArea = document.getElementById('fileInputArea');
  
  console.log('Setting up drag and drop events');
  
  // 파일 입력 영역에 대한 드래그 이벤트
  fileInputArea.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputArea.classList.add('dragover');
  });
  
  fileInputArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputArea.classList.add('dragover');
  });
  
  fileInputArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 마우스가 실제로 영역을 벗어났는지 확인
    const rect = fileInputArea.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      fileInputArea.classList.remove('dragover');
    }
  });
  
  fileInputArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    fileInputArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    console.log('Dropped files:', files.length);
    
    if (files.length > 0) {
      const file = files[0];
      console.log('Processing file:', file.name, file.type);
      handleFileSelection(file);
    }
  });
  
  // 전체 문서에서 드래그 이벤트 방지 (브라우저 기본 동작 방지)
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
  });
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
      showStatus('✅ 이미 UTF-8-sig 형식입니다!\n이 파일은 Excel에서 한글이 정상 표시됩니다.\n추가 변환이 필요하지 않습니다.', 'info');
      convertBtn.disabled = false;
      convertBtn.textContent = originalText;
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
    
    // 인코딩 변환 결과 메시지
    const encodingMessage = encoding === 'utf-8' 
      ? '✅ 변환 완료!\nUTF-8 → UTF-8 with BOM(sig)\n이제 Excel에서 한글이 정상적으로 표시됩니다.'
      : '✅ 변환 완료!\n인코딩이 UTF-8 with BOM(sig)으로 변환되었습니다.\n이제 Excel에서 한글이 정상적으로 표시됩니다.';
    
    showStatus(encodingMessage, 'success');
    
    // 최근 다운로드 정보 제거
    await chrome.runtime.sendMessage({ type: 'CLEAR_RECENT_DOWNLOAD' });
    document.getElementById('recentInfo').style.display = 'none';
    
    // 변환 완료 알림
    const settings = await chrome.storage.sync.get(['showNotifications']);
    if (settings.showNotifications === true) {
      try {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: '변환 완료!',
          message: `${newFileName}이 생성되었습니다.`
        });
      } catch (error) {
        console.log('Notification failed:', error);
      }
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
  
  // 줄바꿈 처리를 위해 HTML로 설정
  statusDiv.innerHTML = message.replace(/\n/g, '<br>');
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
  
  // 성공 메시지는 더 오래 표시
  const timeout = type === 'success' ? 5000 : 4000;
  setTimeout(() => {
    if (statusDiv.style.display !== 'none') {
      statusDiv.style.display = 'none';
    }
  }, timeout);
}