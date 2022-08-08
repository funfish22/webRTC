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

const createPeerConnection = () => {
    pc = new RTCPeerConnection();
    pc.onicecandidate = (e) => {
        const message = {
            type: 'candidate',
            candidate: null,
        };
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
        }
        signaling.postMessage(message);
    };
    pc.ontrack = (e) => (remoteVideo.srcObject = e.streams[0]);
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
};

const makeCall = async () => {
    await createPeerConnection();

    const offer = await pc.createOffer();
    signaling.postMessage({ type: 'offer', sdp: offer.sdp });
    await pc.setLocalDescription(offer);
};

const handleOffer = async (offer) => {
    if (pc) {
        console.error('existing peerconnection');
        return;
    }
    await createPeerConnection();
    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    console.log('answer', answer);
    signaling.postMessage({ type: 'answer', sdp: answer.sdp });
    await pc.setLocalDescription(answer);
};

const handleAnswer = async (answer) => {
    if (!pc) {
        console.error('no peerconnection');
        return;
    }
    await pc.setRemoteDescription(answer);
};

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

closeButton.addEventListener('click', () => {
    hangup();
    signaling.postMessage({ type: 'bye' });
});

const hangup = async () => {
    if (pc) {
        pc.close();
        pc = null;
    }
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
};

init();
