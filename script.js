const mask = document.getElementById('mask');

const constraints = {
    audio: true,
    video: true,
};

const init = () => {
    // 執行 提示用戶使用裝置許可
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        console.log('stream', stream);
        mask.remove();
        devicePermissionsSuccess(stream);
    }).catch = (err) => {
        console.log(err);
    };
};

const devicePermissionsSuccess = (stream) => {
    console.log('stream', stream);

    // 讀取裝置視訊源
    const videoTracks = stream.getVideoTracks();
    // 讀取裝置音效源
    const audioTracks = stream.getAudioTracks();
    console.log('videoTracks', videoTracks);
    console.log('audioTracks', audioTracks);
};

init();
