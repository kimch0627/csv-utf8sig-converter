// Background script for CSV UTF-8-sig Auto Converter
chrome.runtime.onInstalled.addListener(() => {
  console.log('CSV UTF-8-sig Auto Converter installed');
  
  // 기본 설정 저장
  chrome.storage.sync.set({
    autoNotify: true,
    showNotifications: true
  });
});

// 다운로드 완료 감지
chrome.downloads.onChanged.addListener(async (downloadDelta) => {
  console.log('Download event detected:', downloadDelta);
  
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    try {
      const downloadItems = await chrome.downloads.search({ id: downloadDelta.id });
      console.log('Download items found:', downloadItems);
      
      if (downloadItems.length > 0) {
        const download = downloadItems[0];
        const filename = download.filename;
        console.log('Downloaded file:', filename);
        
        // CSV 파일인지 확인
        if (filename && (filename.toLowerCase().endsWith('.csv') || download.mime === 'text/csv')) {
          console.log('CSV file detected');
          await handleCsvDownload(download);
        }
      }
    } catch (error) {
      console.error('Error in download handler:', error);
    }
  }
});

async function handleCsvDownload(downloadItem) {
  try {
    const settings = await chrome.storage.sync.get(['autoNotify', 'showNotifications']);
    console.log('Current settings:', settings);
    
    if (settings.autoNotify === false) {
      console.log('Auto notify disabled, skipping');
      return;
    }
    
    const filename = downloadItem.filename.split('/').pop() || downloadItem.filename.split('\\').pop();
    
    // 최근 다운로드 정보 저장 (팝업에서 표시용)
    await chrome.storage.local.set({
      recentCsvDownload: {
        filename: filename,
        fullPath: downloadItem.filename,
        timestamp: Date.now()
      }
    });
    
    // 확장 프로그램 아이콘에 뱃지 표시
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF4444' });
    
    // 새 탭에서 확장 프로그램 페이지 자동 열기 (팝업 대신)
    const url = chrome.runtime.getURL('popup.html');
    await chrome.tabs.create({
      url: url,
      active: true
    });
    
    console.log('CSV download handled successfully - opened in new tab');
    
  } catch (error) {
    console.error('CSV 처리 중 오류:', error);
  }
}

// 탭이 닫힐 때 뱃지 제거
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    const tabs = await chrome.tabs.query({});
    const extensionTabs = tabs.filter(tab => tab.url && tab.url.includes(chrome.runtime.id));
    
    // 확장 프로그램 탭이 모두 닫혔으면 뱃지 제거
    if (extensionTabs.length === 0) {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.log('Badge clear error:', error);
  }
});

// 확장 프로그램 아이콘 클릭 시 뱃지 제거
chrome.action.onClicked.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});

// 팝업에서 오는 메시지 처리
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_RECENT_DOWNLOAD':
      const recent = await chrome.storage.local.get(['recentCsvDownload']);
      sendResponse(recent.recentCsvDownload || null);
      break;
      
    case 'CLEAR_RECENT_DOWNLOAD':
      await chrome.storage.local.remove(['recentCsvDownload']);
      chrome.action.setBadgeText({ text: '' }); // 뱃지도 함께 제거
      sendResponse({ success: true });
      break;
      
    case 'UPDATE_SETTINGS':
      await chrome.storage.sync.set(message.settings);
      sendResponse({ success: true });
      break;
  }
  
  return true; // 비동기 응답
});