chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.command === "XMLHttpRequest") {
      var httpRequest = new XMLHttpRequest();
      httpRequest.open(request.method, request.url);
      httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
          sendResponse(
            {
              status: httpRequest.status,
              statusText: httpRequest.statusText,
              responseText: httpRequest.responseText,
            }
          );
        }
      };
      httpRequest.send();
      return true;
    } else if (request.command === "donwload") {
      chrome.downloads.download(
        {
          url: request.url,
          filename: request.filename,
        },
        sendResponse,
      );
      return true;
    }
  }
);
