// Content script for CSV conversion dialog
let conversionDialog = null;

console.log('CSV Converter content script loaded');

// Background script에서 오는 메시지 처리
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'SHOW_CONVERSION_DIALOG':
      console.log('Showing conversion dialog for:', message.data.filename);
      showConversionDialog(message.data);
      sendResponse({ success: true });
      break;
  }
  
  return true; // 비동기 응답을 위해 true 반환
});

function showConversionDialog(data) {
  console.log('Creating dialog for:', data.filename);
  
  // 기존 다이얼로그가 있으면 제거
  if (conversionDialog && conversionDialog.parentNode) {
    conversionDialog.remove();
  }
  
  // 다이얼로그 생성
  conversionDialog = createDialog(data);
  document.body.appendChild(conversionDialog);
  console.log('Dialog added to page');
  
  // 10초 후 자동으로 "예" 선택
  setTimeout(() => {
    if (conversionDialog && conversionDialog.parentNode) {
      console.log('Auto-converting after 10 seconds');
      handleConversion(data.conversionId, true);
    }
  }, 10000);
}

function createDialog(data) {
  const dialog = document.createElement('div');
  dialog.id = 'csv-converter-dialog';
  dialog.innerHTML = `
    <div class="csv-dialog-overlay">
      <div class="csv-dialog-content">
        <div class="csv-dialog-header">
          <h3>CSV 파일 변환</h3>
          <button class="csv-dialog-close" onclick="window.csvConverter.closeDialog()">×</button>
        </div>
        <div class="csv-dialog-body">
          <p><strong>${data.filename}</strong> 파일이 다운로드되었습니다.</p>
          <p>UTF-8-sig 인코딩으로 변환하시겠습니까?</p>
          <div class="csv-dialog-info">
            <small>• UTF-8-sig는 Excel에서 한글이 정상 표시됩니다</small><br>
            <small>• 10초 후 자동으로 변환됩니다</small>
          </div>
        </div>
        <div class="csv-dialog-footer">
          <button class="csv-dialog-btn csv-dialog-btn-secondary" onclick="window.csvConverter.handleConversion('${data.conversionId}', false)">
            아니오
          </button>
          <button class="csv-dialog-btn csv-dialog-btn-primary" onclick="window.csvConverter.handleConversion('${data.conversionId}', true)">
            예, 변환
          </button>
        </div>
        <div class="csv-dialog-options">
          <label>
            <input type="checkbox" id="csv-always-convert"> 
            항상 자동 변환
          </label>
          <label>
            <input type="checkbox" id="csv-never-convert"> 
            다시 묻지 않음
          </label>
        </div>
      </div>
    </div>
  `;
  
  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    #csv-converter-dialog {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .csv-dialog-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .csv-dialog-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      min-width: 400px;
      max-width: 500px;
      animation: csvDialogShow 0.3s ease-out;
    }
    
    @keyframes csvDialogShow {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    
    .csv-dialog-header {
      padding: 20px 20px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .csv-dialog-header h3 {
      margin: 0;
      color: #1a73e8;
      font-size: 18px;
    }
    
    .csv-dialog-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
    }
    
    .csv-dialog-close:hover {
      background: #f1f3f4;
    }
    
    .csv-dialog-body {
      padding: 20px;
    }
    
    .csv-dialog-body p {
      margin: 0 0 15px 0;
      color: #333;
      line-height: 1.5;
    }
    
    .csv-dialog-info {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 8px;
      margin-top: 15px;
    }
    
    .csv-dialog-info small {
      color: #666;
      line-height: 1.4;
    }
    
    .csv-dialog-footer {
      padding: 0 20px 20px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    
    .csv-dialog-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .csv-dialog-btn-primary {
      background: #1a73e8;
      color: white;
    }
    
    .csv-dialog-btn-primary:hover {
      background: #1557b0;
    }
    
    .csv-dialog-btn-secondary {
      background: #f8f9fa;
      color: #333;
      border: 1px solid #dadce0;
    }
    
    .csv-dialog-btn-secondary:hover {
      background: #e8eaed;
    }
    
    .csv-dialog-options {
      padding: 0 20px 20px;
      border-top: 1px solid #e0e0e0;
      margin-top: 10px;
      padding-top: 15px;
    }
    
    .csv-dialog-options label {
      display: block;
      margin-bottom: 8px;
      font-size: 13px;
      color: #666;
      cursor: pointer;
    }
    
    .csv-dialog-options input[type="checkbox"] {
      margin-right: 8px;
    }
  `;
  
  dialog.appendChild(style);
  
  return dialog;
}

function handleConversion(conversionId, convert) {
  // 설정 업데이트 확인
  const alwaysConvert = document.getElementById('csv-always-convert')?.checked;
  const neverConvert = document.getElementById('csv-never-convert')?.checked;
  
  if (alwaysConvert || neverConvert) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: {
        alwaysConvert: alwaysConvert,
        neverConvert: neverConvert,
        autoPrompt: !alwaysConvert && !neverConvert
      }
    });
  }
  
  // 변환 처리 메시지 전송
  chrome.runtime.sendMessage({
    type: 'CONVERT_CSV',
    conversionId: conversionId,
    convert: convert
  });
  
  closeDialog();
}

function closeDialog() {
  if (conversionDialog && conversionDialog.parentNode) {
    conversionDialog.remove();
    conversionDialog = null;
  }
}

// 전역 객체로 함수 노출 (HTML에서 호출하기 위해)
window.csvConverter = {
  handleConversion,
  closeDialog
};

// 오버레이 클릭 시 다이얼로그 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('csv-dialog-overlay')) {
    closeDialog();
  }
});

// ESC 키로 다이얼로그 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && conversionDialog) {
    closeDialog();
  }
});