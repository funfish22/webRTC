/**
 * pc1,pc2 => peer-to-peer connection流程
 * step1: 建立Local peer connection  => signalingState: "statable"
 * step1.5: 將stream track 與peer connection 透過addTrack()關聯起來，之後建立連結才能進行傳輸！
 * step2: local peer call createOffer methods to create RTCSessionDescription(SDP) => signalingState: "have-local-offer"
 * step3: setLocalDescription() is called 然後傳給remote peer
 * step4: remote peer 收到後透過setRemoteDescription() 建立description for local peer.
 * step5: 建立成功後local peer會觸發icecandidate event 就能將serialized candidate data 通過signaling channel交付給remote peer
 * step6: Remote peer 建立createAnswer 將自己的SDP 回傳給Local peer
 * step7: Local peer收到後透過setRemoteDescription() 建立description for remote peer
 * Ping ! p2p 完成
 */

// 遮罩
const mask = document.getElementById('mask');
// 視訊連接按鈕
const callButton = document.getElementById('callButton');
// 本地視訊
const localVideo = document.getElementById('local_video');
// 遠端視訊
const remoteVideo = document.getElementById('remote_video');
// 關閉視訊按鈕
const closeButton = document.getElementById('closeButton');
// 視訊設定
let constraints = {
    audio: false,
    video: true,
};

// 本地 stream
let localStream;

let pc;

// 下拉選單
const selectVideo = document.getElementById('selectVideo');
const selectAudio = document.getElementById('selectAudio');
const VIDEO_DEVICES = [];
const AUDIO_DEVICES = [];
let videoString = '';
let audioString = '';

const signaling = new BroadcastChannel('webrtc');
signaling.onmessage = (e) => {
    if (!localStream) {
        console.log('not ready yet');
    }
    switch (e.data.type) {
        case 'offer':
            handleOffer(e.data);
            break;
        case 'answer':
            handleAnswer(e.data);
            break;
        case 'candidate':
            handleCandidate(e.data);
            break;
        case 'ready':
            if (pc) {
                console.log('already in call, ignoring');
                return;
            }
            makeCall();
            break;
        case 'bye':
            if (pc) {
                hangup();
            }
            break;
        default:
            break;
    }
};

const init = () => {
    // 執行 提示用戶使用裝置許可
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        mask.remove();
        // devicePermissionsSuccess(stream);

        // 讀取所有相機跟麥克風裝置
        allDevices();
    }).catch = (err) => {
        console.log('err', err);
    };
};

// 列出所有相機跟麥克風裝置
const allDevices = () => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
        console.log('devices', devices);
        var arrayLength = devices.length;
        for (var i = 0; i < arrayLength; i++) {
            let tempDevice = devices[i];
            // 所有相機跟麥克風裝置
            if (tempDevice.kind == 'videoinput') {
                VIDEO_DEVICES.push(tempDevice);
            }
            // 列出所有麥克風
            if (tempDevice.kind == 'audiooutput') {
                AUDIO_DEVICES.push(tempDevice);
            }
        }
        VIDEO_DEVICES.forEach((row) => {
            videoString += `<option value=${row.deviceId}>${row.label || row.kind}</option>`;
        });
        selectVideo.innerHTML = videoString;
        videoString = '';

        AUDIO_DEVICES.forEach((row) => {
            audioString += `<option value=${row.deviceId}>${row.label || row.kind}</option>`;
        });
        selectAudio.innerHTML = audioString;
        audioString = '';

        constraints.video = {
            deviceId: { exact: VIDEO_DEVICES[0].deviceId },
        };
        devicePermissionsSuccess();
        // 變更畫面
        selectVideo.addEventListener('change', (e) => {
            constraints.video.deviceId.exact = e.target.value;
            devicePermissionsSuccess();
        });
    });
};

const devicePermissionsSuccess = () => {
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        localStream = stream;
        localVideo.srcObject = stream;
    }).catch = (err) => {
        console.log('err', err);
    };
};

callButton.addEventListener('click', () => {
    signaling.postMessage({ type: 'ready' });
});

// 這邊使用 webAPI BroadcastChannel 可以在瀏覽器兩個標籤(tag)做信令服務器

const makeCall = async () => {
    // 建立點對點串流(RTCPeerConnection)
    await createPeerConnection();

    // 4. 點對點建立完成，Bob 創建一個 offer
    // 並呼叫 setLocalDescription 設定本地的 SDP
    const offer = await pc.createOffer();
    // 5. 通過 Signaling server(信令服務器) 將包含 Bob SDP 的 offer 發送給 Alice。
    signaling.postMessage({ type: 'offer', sdp: offer.sdp });
    await pc.setLocalDescription(offer);
};

const createPeerConnection = () => {
    // 1. RTCPeerConnection(建立點對點串流) 負責多媒體串流的傳送
    pc = new RTCPeerConnection();
    // 2. 綁定onicecandidate事件
    // 3. 當查找到相對應的遠端端口時會做 onIceCandidate callback function 進行網路資訊的共享
    // 10. 當雙方都連線才會做以下動作
    pc.onicecandidate = (e) => {
        const message = {
            type: 'candidate',
            candidate: null,
        };
        if (e.candidate) {
            // alice(Bob) 者描述訊息
            message.candidate = e.candidate.candidate;
            // bob 與 alice 相關的媒體流的識別標籤
            message.sdpMid = e.candidate.sdpMid;
            // SDP 索引
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        signaling.postMessage(message);
    };
    // 12. 雙方訊息(offer/answer)交換完畢
    // 13. 藉由綁定 ontrack 來接收 Alice(Bob) 傳遞過來的多媒體資訊，顯示對方視訊到畫面
    pc.ontrack = (e) => (remoteVideo.srcObject = e.streams[0]);
    // 14. Bob(Alice) 藉由 getTracks 擷取並透過 addTrack 載入多媒體資訊，顯示本地視訊到畫面
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
};

// 11. 當 Alice(Bob) 藉由信令服務器接收到由 Bob(Alice) 傳來的 ICE candidate(交換網路連線的建立方式) 時，
// 利用 addIceCandidate 將其丟給瀏覽器解析與匹配，查看這個 ICE candidate(交換網路連線的建立方式) 所提供的連線方式適不適合。
const handleCandidate = async (candidate) => {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    if (!candidate.candidate) {
        await pc.addIceCandidate(null);
    } else {
        await pc.addIceCandidate(candidate);
    }
};

const handleOffer = async (offer) => {
    if (pc) {
        console.error('existing peerconnection');
        return;
    }
    // 6. Alice 也要跟 Bob 確認連線方式
    await createPeerConnection();
    // 7. Alice 收到 offer 後呼叫 setRemoteDescription 設定 Bob 的 SDP。
    await pc.setRemoteDescription(offer);

    // 8. Alice createAnswer 創建一個 answer ，並呼叫 setLocalDescription 設定本地的 SDP。
    const answer = await pc.createAnswer();
    signaling.postMessage({ type: 'answer', sdp: answer.sdp });
    await pc.setLocalDescription(answer);
};

const handleAnswer = async (answer) => {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    // 9. Bob 收到 answer 後呼叫 setRemoteDescription 設定 Alice 的SDP
    await pc.setRemoteDescription(answer);
};

// 關閉按鈕
closeButton.addEventListener('click', () => {
    // Alice 關閉
    hangup();
    // Bob 關閉
    signaling.postMessage({ type: 'bye' });
});

const hangup = async () => {
    // pc為各自對應的媒體資訊
    if (pc) {
        pc.close();
        pc = null;
    }
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
};

init();
