(function () {
  var illegalRe = /[\/\?<>\\:\*\|"]/g;
  var controlRe = /[\x00-\x1f\x80-\x9f]/g;
  var reservedRe = /^\.+$/;
  var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  var windowsTrailingRe = /[\. ]+$/;

  function sanitize(input, replacement) {
    var output = input
      .replace(illegalRe, replacement)
      .replace(controlRe, replacement)
      .replace(reservedRe, replacement)
      .replace(windowsReservedRe, replacement)
      .replace(windowsTrailingRe, replacement);
    if (input !== output) {
      console.log('  sanitize [' + input + '] to [' + output + ']');
    }
    return output;
  }

  window.addEventListener(
    "message",
    function (event) {
      // only accept messages from ourselves
      if (event.source !== window) {
        return;
      }

      if (event.data.type && event.data.type === "FROM_PAGE") {
        console.log('Request from page to [' + event.data.command + ']');
        document.getElementById(event.data.elementId).classList.add('attention');
        chrome.runtime.sendMessage(
          {
            command: event.data.command,
            url: event.data.url,
            filename: event.data.filename,
          },
          function (downloadId) {
            document.getElementById(event.data.elementId).classList.remove('attention');
            if (downloadId) {
              console.log('  starting the download successfully - downloadId is [' + downloadId + ']');
            } else {
              console.log('  starting the download error - ' + chrome.runtime.lastError);
            }
          },
        );
      }
    },
    false,
  );

  function isLogoToSidedockElemenAdded(sidedockElement) {
    return sidedockElement.querySelector(".__svd-logo__") !== null;
  }

  function logoToSidedockElemenAdd(sidedockElement) {
    var svdLogo = document.createElement('div');
    svdLogo.classList.add('box', '__svd-logo__');
    svdLogo.innerHTML = "<img src='" + injectIconURL + "'/>";
    sidedockElement.appendChild(svdLogo);
  }

  function logoFromSidedockElemenDel(sidedockElement) {
    sidedockElement.querySelector(".__svd-logo__").remove();
  }

  function generateLinkInnerHTML(id, url, filename, text, title) {
    return "" +
      "<a download href='" + url + "' target='_blank' title='" + title + "'" +
      "  id='" + id + "'" +
      "  onclick='" +
      "    window.postMessage(" +
      "      {" +
      "        type: \"FROM_PAGE\"," +
      "        command: \"donwload\"," +
      "        url: \"" + url + "\"," +
      "        filename: \"" + filename + "\"," +
      "        elementId: this.id," +
      "      }," +
      "      \"*\"," +
      "    );" +
      "    return false;" +
      "  '>" +
      "  <button class='rounded-box'>" + text + "</button>" +
      "</a>";
  }

  function downloadOptionsFromVimeoJSONToSidedockElemenAdd(vimeoJSON, sidedockElement) {
  	var _hqvideo = null;
  	var _engsubt = null;
  	var _export = {
  		title: null,
  		video: null,
  		subtitle: null
  	};

    var groupElement = document.createElement('div');
    groupElement.classList.add('__svd-group__');

    var videosElement = document.createElement('div');
    videosElement.classList.add('__svd-column__');

    var subtitlesElement = document.createElement('div');
    subtitlesElement.classList.add('__svd-column__');

    groupElement.append(subtitlesElement, videosElement);

    sidedockElement.appendChild(groupElement);

    var sanitizedVideoTitle = sanitize(vimeoJSON.video.title, '_');

    var files = vimeoJSON.request.files.progressive;
    if (files) {
      files.sort(vimeoDownloadCompare).reverse();

      // Grab highest quality video
      _hqvideo = files.find(f => f.quality == '1080p') || files[0];
      _export.video = _hqvideo.url;
      _export.title = sanitizedVideoTitle;

      files.forEach(function (v, i) {
        var element = document.createElement('div');
        element.classList.add('box', '__svd-download__');
        element.innerHTML = generateLinkInnerHTML(
          "svd-file-download-link-" + i,
          v.url,
          sanitizedVideoTitle + " (" + v.quality + " with " + v.fps + "fps)" + ".mp4",
          v.quality,
          "Download " + v.quality + " with " + v.fps + "fps",
        );
        videosElement.appendChild(element);
      });
    }

    var textTracks = vimeoJSON.request.text_tracks;
    if (textTracks) {

      // Grab english subtitles
      _engsubt = textTracks.find(t => t.lang == 'en') || textTracks[0];
      _export.subtitle = "https://vimeo.com" + topSub.url;

      textTracks.forEach(function (v, i) {
        var element = document.createElement('div');
        element.classList.add('box', '__svd-download__');
        element.innerHTML = generateLinkInnerHTML(
          "svd-text-track-download-link-" + i,
          "https://vimeo.com" + v.url,
          sanitizedVideoTitle + " (" + v.lang + ")" + ".vtt",
          v.lang,
          "Download " + v.label + " subtitles",
        );
        subtitlesElement.appendChild(element);
      });
    }

    // Show export data
    var message = `Video (${_hqvideo.quality})`;
    message += _engsubt ? `, Subtitle (${_engsubt.lang})` : '';
    prompt(message, JSON.stringify(_export));
  }

  function vimeoDownloadCompare(a, b) {
    aquality = parseInt(a.quality);
    afps = a.fps;
    bquality = parseInt(b.quality);
    bfps = b.fps;
    if (aquality === bquality) {
      if (afps === bfps) {
        return 0;
      } else if (afps < bfps) {
        return -1;
      } else {
        return 1;
      }
    } else if (aquality < bquality) {
      return -1;
    } else {
      return 1;
    }
  }

  function searchWithinDocumentScripts(regExp) {
    var scriptList = document.getElementsByTagName('script');
    for (var i = 0; i < scriptList.length; i++) {
      var script = scriptList[i];
      var match = regExp.exec(script.text);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }

  var injectIconURL = chrome.extension.getURL("inject_icon.svg");

  var videoConfigURL;

  var vimeoReviewSite = /:\/\/vimeo\.com\/.*\/review\/.*/g.test(document.URL);
  if (vimeoReviewSite) {
    var vimeoReviewMatch = searchWithinDocumentScripts(/({[^{]*"vimeo_esi[\s\S]*?config[\s\S]*?clipData[\s\S]*?configUrl[\s\S]*?})\);/gm);
    if (vimeoReviewMatch !== null) {
      var vimeoReviewJSON = JSON.parse(vimeoReviewMatch[1]);
      videoConfigURL = vimeoReviewJSON.vimeo_esi.config.clipData.configUrl;
    } else {
      console.log('  can not find proper vimeo review config script on [' + document.URL + ']');
      return { status: 'script-absent' };
    }
  } else {
    var vimeoSite = /:\/\/vimeo\.com.*/g.test(document.URL);
    if (vimeoSite) {
      var playerContainer = document.querySelector(".player_container");
      if (playerContainer === null) {
        console.log('  vimeo player container is absent on [' + document.URL + ']');
        return { status: 'player-absent' };
      }
      var playerContainerIdMatch = /clip_(\d+)/g.exec(playerContainer.id);
      if (playerContainerIdMatch === null) {
        console.log('  vimeo player container id [' + playerContainer.id + '] is unsupported on [' + document.URL + ']');
        return { status: 'player-absent' };
      }
      var vimeoSiteVideoId = playerContainerIdMatch[1];

      var playerElement = document.querySelector("[id='" + vimeoSiteVideoId + "'][data-config-url]");
      if (playerElement === null) {
        console.log('  vimeo player element with config URL is absent on [' + document.URL + '] - default config URL will be used');
        videoConfigURL = 'https://player.vimeo.com/video/' + vimeoSiteVideoId + '/config';
      } else {
        videoConfigURL = playerElement.getAttribute('data-config-url');
      }
    }
  }

  if (window === top) {
    if (vimeoReviewSite) {
      console.log('Inject Simple Vimeo Downloader Button into vimeo player on vimeo review site');
    } else if (vimeoSite) {
      console.log('Inject Simple Vimeo Downloader Button into vimeo player on vimeo site');
    } else {
      console.log('Inject Simple Vimeo Downloader Button into vimeo player on embed site');
    }
  }

  var sidedockElement = document.querySelector(".controls-wrapper > .sidedock, .vp-controls-wrapper > .vp-sidedock");
  if (sidedockElement === null) {
    console.log('  vimeo player is absent on [' + document.URL + ']');
    return { status: 'player-absent' };
  } else {
    if (isLogoToSidedockElemenAdded(sidedockElement)) {
      console.log('  already injected in vimeo player on [' + document.URL + ']');
      return { status: 'already-injected' };
    } else {
      logoToSidedockElemenAdd(sidedockElement);

      if (videoConfigURL) {
        chrome.runtime.sendMessage(
          {
            command: 'XMLHttpRequest',
            method: 'GET',
            url: videoConfigURL,
          },
          function (response) {
            if (response.status === 200) {
              var vimeoJSON = JSON.parse(response.responseText);
              downloadOptionsFromVimeoJSONToSidedockElemenAdd(vimeoJSON, sidedockElement);
              console.log('  successful injected in vimeo player on [' + document.URL + '] with video title - ' + vimeoJSON.video.title);
            } else {
              logoFromSidedockElemenDel(sidedockElement);
              console.log('  AJAX request to [' + videoConfigURL + '] fail with status [' + response.statusText + ']');
            }
          },
        );
        return { status: 'async-injecting' };
      } else {
        var vimeoMatch = searchWithinDocumentScripts(/({[^{]*"[\s\S]*?request[\s\S]*?files[\s\S]*?progressive[\s\S]*?});/gm);
        if (vimeoMatch !== null) {
          var vimeoJSON = JSON.parse(vimeoMatch[1]);
          downloadOptionsFromVimeoJSONToSidedockElemenAdd(vimeoJSON, sidedockElement);
          console.log('  successful injected in vimeo player on [' + document.URL + '] with video title - ' + vimeoJSON.video.title);
          return { status: 'successful-injected' };
        } else {
          console.log('  can not find proper vimeo player script on [' + document.URL + ']');
          return { status: 'script-absent' };
        }
      }
    }
  }
})();
