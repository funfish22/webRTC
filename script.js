// 連到firebase
// const firebaseConfig = {
//     apiKey: 'AIzaSyBby4ky5c8V1OpVK6vxccqfhi96UGB7ngI',
//     authDomain: 'fir-rtc-5b633.firebaseapp.com',
//     projectId: 'fir-rtc-5b633',
//     storageBucket: 'fir-rtc-5b633.appspot.com',
//     messagingSenderId: '254847624149',
//     appId: '1:254847624149:web:ff4f9757f34577eb51135c',
//     measurementId: 'G-795ZGKM0F6',
// };

// // Initialize Firebase
// firebase.initializeApp(firebaseConfig);
// var db = firebase.database();

// window.AudioContext = window.AudioContext || window.webkitAudioContext;
const mask = document.getElementById('mask');

// 關閉視訊按鈕
const closeButton = document.getElementById('closeButton');
// 本地視訊
const localVideo = document.getElementById('local_video');
// 遠端視訊
const remoteVideo = document.getElementById('remote_video');
// 建立房間按鈕
// const createRoomButton = document.getElementById('createRoomButton');
// 視訊連接
const callButton = document.getElementById('callButton');
// 錄製影片
const recorder = document.getElementById('recorder');
// 取消錄製影片
const closeRecorder = document.getElementById('closeRecorder');
// 暫停錄製影片
const pauseRecorder = document.getElementById('pauseRecorder');

// 本地
let localPeer;
// 遠端
let remotePeer;

let pc1;
let pc2;
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1,
};

const getOtherPc = (pc) => {
    console.log('pcpcpcpcpcpcpc', pc);
    return pc === pc1 ? pc2 : pc1;
};

const buildPeerConnection = (label, configuration) => {
    const peer = new RTCPeerConnection(configuration);
    peer.onicecandidate = (e) => onIceCandidate(label, e);
    peer.oniceconnectionstatechange = (e) => onIceStateChange(label, e);

    return peer;
};

const onIceCandidate = async (pc, event) => {
    try {
        await getOtherPc(pc).addIceCandidate(event.candidate);
    } catch {}
};

// 視訊設定
let constraints = {
    audio: false,
    video: true,
};

// 錄影設定
const recordMediaType = 'video/webm; codecs=vp9';
const options = { mimeType: recordMediaType };

// 當前 stream
let localStream = {};

let recordChunks = [];

let mediaRecorder = null;

// 初始化
const init = () => {
    // 執行 提示用戶使用裝置許可
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        mask.remove();
        // stream.onactive = onactive;
        // stream.oninactive = oninactive;
        devicePermissionsSuccess(stream);

        allDevices();
    }).catch = (err) => {
        console.log('err', err);
    };
};

const onactive = () => {
    console.log('on active event');
};

const oninactive = () => {
    console.log('on inactive event');
};

// 讀取裝置成功，並顯示在畫面上
const devicePermissionsSuccess = (stream) => {
    localStream = stream;
    // const aaaaa = stream.getTracks();
    stream.onactive = onactive;
    stream.oninactive = oninactive;
    stream.active = false;
    console.log('stream', stream);
    // 讀取裝置視訊源
    const videoTracks = stream.getVideoTracks();
    // 讀取裝置音效源
    const audioTracks = stream.getAudioTracks();

    console.log('videoTracks', videoTracks);
    console.log('audioTracks', audioTracks);

    localVideo.srcObject = stream;
};

// 下拉選單
const selectVideo = document.getElementById('selectVideo');
const selectAudio = document.getElementById('selectAudio');

const VIDEO_DEVICES = [];
const AUDIO_DEVICES = [];
let videoString = '';
let audioString = '';
// 列出所有相機跟麥克風裝置
const allDevices = () => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
        // console.log('所有裝置', devices);

        var arrayLength = devices.length;
        // 所有相機跟麥克風裝置
        for (var i = 0; i < arrayLength; i++) {
            let tempDevice = devices[i];
            if (tempDevice.kind == 'videoinput') {
                VIDEO_DEVICES.push(tempDevice);
            }
        }
        // 列出所有麥克風
        for (var i = 0; i < arrayLength; i++) {
            let tempDevice = devices[i];
            if (tempDevice.kind == 'audiooutput') {
                AUDIO_DEVICES.push(tempDevice);
            }
        }
        // console.log('-----所有相機裝置-----');
        // console.log('VIDEO_DEVICES', VIDEO_DEVICES);
        // console.log('-----所有麥克風裝置-----');
        // console.log('AUDIO_DEVICES', AUDIO_DEVICES);

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

        // 變更畫面
        selectVideo.addEventListener('change', (e) => {
            // console.log('選取的裝置', e);
            constraints = {
                audio: false,
                video: {
                    deviceId: { exact: e.target.value },
                },
            };
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
                devicePermissionsSuccess(stream);
            }).catch = (err) => {
                console.log('err', err);
            };
        });
    });
};

const handleCall = async () => {
    const configuration = {};
    pc1 = buildPeerConnection('pc1', configuration);
    pc2 = buildPeerConnection('pc2', configuration);
    console.log('222', pc2);
    pc2.ontrack = gotRemoteStream;

    localStream.getTracks().forEach((track) => {
        console.log('track', track);
        pc1.addTrack(track, localStream);
    });

    try {
        const offer = await pc1.createOffer(offerOptions);
        await onCreateOfferSuccess(offer);
    } catch (e) {}
};

const onCreateOfferSuccess = async (desc) => {
    console.log('desc', desc);
    try {
        await pc1.setLocalDescription(desc);
    } catch (e) {}
    try {
        await pc2.setRemoteDescription(desc);
    } catch (e) {}
    try {
        const answer = await pc2.createAnswer();
        console.log('answer', answer);
        await onCreateAnswerSuccess(answer);
    } catch (e) {}
};

const onCreateAnswerSuccess = async (desc) => {
    try {
        await pc2.setLocalDescription(desc);
    } catch (e) {}
    try {
        await pc1.setRemoteDescription(desc);
    } catch (e) {}
};

const onIceStateChange = () => {};

const gotRemoteStream = (e) => {
    if (remoteVideo.srcObject !== e.streams[0]) {
        console.log('e.streams[0]', e.streams[0]);
        console.log('localStream', localStream);
        remoteVideo.srcObject = e.streams[0];
    }
};

callButton.addEventListener('click', () => {
    handleCall();
});

// 關閉視訊
const handUp = (e) => {
    const tracks = localVideo.srcObject.getTracks();
    tracks.forEach((track) => {
        track.stop();
    });
    localVideo.srcObject = null;
};

// 綁定關閉按鈕
closeButton.addEventListener('click', () => {
    handUp();
});

// 綁定建立房間按鈕
// createRoomButton.addEventListener('click', async () => {
//     const roomRef = await db.collection('aaaaa').doc();
//     console.log('roomRef', roomRef);
// });

// 綁定錄影按鈕
recorder.addEventListener('click', () => {
    mediaRecorder = new MediaRecorder(localStream, options);
    console.log('1111111111111111', mediaRecorder);

    mediaRecorder.start();
    mediaRecorder.onstart = (enevt) => {
        console.log('onstart enevt', enevt);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
    mediaRecorder.onpause = handlePause;
});

closeRecorder.addEventListener('click', () => {
    mediaRecorder.stop();
});

pauseRecorder.addEventListener('click', () => {
    mediaRecorder.pause();
});

const handleDataAvailable = (event) => {
    console.log('data-available', event);
    recordChunks.push(event.data);
};

const handleStop = (event) => {
    console.log('onstop event', event);
    let blob = new Blob(recordChunks, { type: recordMediaType });
    let blobURL = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobURL;
    a.download = 'test.webm';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobURL);
    }, 100);
};

const handlePause = (event) => {
    console.log('Pause event', event);
};

init();
