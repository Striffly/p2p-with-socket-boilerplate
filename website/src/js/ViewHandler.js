/**
 * ViewHandler
 * Management class for view events and actions
 */
export default class ViewHandler {
    constructor() {
        this.videoStream = document.getElementById('videoStream');
        this.videoStream.autoplay = true;

        this.reset();
    }

    reset() {

    }

    /**
     * When receiving the peer-to-peer video stream
     * @param stream
     */
    onStream(stream) {
        this.videoStream.src = window.URL.createObjectURL(stream);
        this.videoStream.play();
    }
}