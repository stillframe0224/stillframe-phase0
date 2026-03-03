export function useCamera() {
  return {
    zoom: 0,
    camDrag: null,
    startCamDrag: () => {},
    handleBgWheel: () => {},
    setZoom: () => {},
  };
}
