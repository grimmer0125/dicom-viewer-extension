import React, { Component } from "react";
import Slider from "rc-slider";
import "rc-slider/assets/index.css";

import {
  Dropdown,
  Form,
  Checkbox,
  CheckboxProps,
  DropdownProps,
} from "semantic-ui-react";

import Dropzone from "react-dropzone";
import Hotkeys from "react-hot-keys";
import * as daikon from "daikon";

const { fromEvent } = require("file-selector");

// declare global {
//   interface Window {
//     daikon: any;
//   }
// }

// const daikon = window.daikon;

const dropZoneStyle = {
  borderWidth: 2,
  borderColor: "#666",
  borderStyle: "dashed",
  borderRadius: 5,
  width: 800,
  height: 150,
  // textAlign: "center",
};

const emptyFile = {
  frameIndexes: [],
  currFrameIndex: 0,
  multiFrameInfo: "",
  windowCenter: "",
  windowWidth: "",
  max: "",
  min: "",
  resX: "",
  resY: "",
  photometric: "",
  modality: "",
  hasDICOMExtension: true,
};

type State = {
  ifWindowCenterMode: boolean;
  currFilePath: string;
  currFileNo: number;
  totalFiles: number;
  frameIndexes: any[];
  currFrameIndex: number;
  multiFrameInfo: string;
  windowCenter: string;
  windowWidth: string;
  max: string;
  min: string;
  resX: string;
  resY: string;
  photometric: string;
  modality: string;
  hasDICOMExtension: boolean;
};

class App extends Component<{}, State> {
  myCanvasRef: React.RefObject<HTMLCanvasElement>;
  files: any[];
  isOnlineMode = true;
  currentImage: any;

  constructor() {
    super({});
    this.state = {
      ifWindowCenterMode: true,
      currFilePath: "",
      // multiFrameInfo: '',
      // currFrameIndex: 0,
      // frameIndexes: [],
      // windowCenter: '',
      // windowWidth: '',
      // max: '',
      // min: '',
      // resX: '',
      // resY: '',
      // photometric: '',
      // modality: '',
      currFileNo: 0,
      totalFiles: 0,
      ...emptyFile,
    };
    this.myCanvasRef = React.createRef();
    this.files = [];
  }

  componentDidMount() {
    // get file path from current url, e.g.
    // chrome-extension://jfnlfimghfiagibfigmlopnfljpfnnje/dicom.html#file:///tmp/test.dcm
    const url = window.location.href;
    // 'http://localhost#http://medistim.com/wp-content/uploads/2016/07/ttfm.dcm'; //
    // console.log("current url:", url);

    if (
      url.toLowerCase().indexOf(".dcm") !== -1 ||
      url.toLowerCase().indexOf(".dicom") !== -1
    ) {
      // const paths = url.split("#");
      const firstHash = url.indexOf("#");
      if (firstHash > -1) {
        const fileURLs = url.substring(firstHash + 1, url.length);
        // const filePath = paths[1];
        // this.fetchFile(filePath);

        this.onOpenFileURLs(fileURLs);
      }
    }
  }

  handleNormalizeModeChange = (
    e: React.FormEvent<HTMLInputElement>,
    data: CheckboxProps
  ) => {
    const { value } = data;
    let ifWindowCenterMode;
    if (value === "center") {
      ifWindowCenterMode = true;
    } else {
      ifWindowCenterMode = false;
    }
    this.setState({ ifWindowCenterMode });

    if (this.currentImage) {
      const { currFrameIndex } = this.state;
      this.renderFrame(this.currentImage, currFrameIndex, ifWindowCenterMode);
    }
  };

  renderImage = (buffer: any) => {
    console.log("renderImage bytelength:", buffer.byteLength);
    if (buffer) {
      daikon.Parser.verbose = true;
      const image = daikon.Series.parseImage(new DataView(buffer));
      const numFrames = image.getNumberOfFrames();
      if (numFrames > 1) {
        // console.log("frames:", numFrames);
        const multiFrameInfo = `It's multi-frame file (n=${numFrames})`;

        this.setState({
          multiFrameInfo,
        });
      } else {
        this.setState({
          multiFrameInfo: "",
        });
      }
      this.setState({
        frameIndexes: Array.from(
          {
            length: numFrames,
          },
          (v, k) => ({
            text: k,
            value: k,
          })
        ),
        currFrameIndex: 0,
      });
      this.currentImage = image;
      this.renderFrame(this.currentImage, 0);
    }
  };

  renderFrame = (
    image: any,
    frameIndex: number,
    ifWindowCenterMode?: boolean
  ) => {
    console.log(`switch to ${frameIndex} Frame`);

    let ifRGB = false;
    let rgbMode = 0; // 0: rgbrgb... 1: rrrgggbbb
    // BUG:
    // fetchFile (file://) case will need longer time to getPhotometricInterpretation after using a while
    const photometric = image.getPhotometricInterpretation();
    const modality = image.getModality();
    if (photometric !== null) {
      const mode = image.getPlanarConfig();
      console.log("Planar mode:", mode);
      if (photometric.trim().indexOf("RGB") !== -1) {
        ifRGB = true;

        rgbMode = image.getPlanarConfig() || 0;
      } else if (photometric.trim().toLowerCase().indexOf("palette") !== -1) {
        ifRGB = true;
      }
    }

    // getPhotometricInterpretation
    // https://github.com/rii-mango/Daikon/issues/4
    // The new function will handle things like byte order, number of bytes per voxel, datatype, data scales, etc.
    // It returns an array of floating point values. So far this is only working for plain intensity data, not RGB.
    const obj = image.getInterpretedData(false, true, frameIndex); // obj.data: float32array
    const width: number = obj.numCols;
    const height: number = obj.numRows;
    const windowCenter = image.getWindowCenter();
    const windowWidth = image.getWindowWidth();
    this.setState({
      windowCenter,
      windowWidth,
      max: obj.max,
      min: obj.min,
      resX: width.toString(),
      resY: height.toString(),
      modality,
      photometric,
    });

    let max;
    let min;
    if (ifWindowCenterMode === undefined) {
      ({ ifWindowCenterMode } = this.state);
    }
    if (!ifWindowCenterMode) {
      console.log("mode1");
      ({ max, min } = obj);
    } else if (windowCenter && windowWidth) {
      console.log("mode2");

      min = windowCenter - Math.floor(windowWidth / 2);
      max = windowCenter + Math.floor(windowWidth / 2);

      // truncate
      for (let i = 0; i < obj.data.length; i += 1) {
        if (obj.data[i] > max) {
          obj.data[i] = max;
        } else if (obj.data[i] < min) {
          obj.data[i] = min;
        }
      }
    } else {
      console.log("no valid window center/width");
      ({ max, min } = obj);
    }

    // little endian type of dicom data seems to be unit16, http://rii.uthscsa.edu/mango/papaya/ shows 2 byte
    // obj.data: float32, length:262144 (if dicom image is 512x512)
    // NOTE: 32bit -> 8 bit (use min/max to normalize to 0~255 from -1000~1000）
    // let max = null;
    // let min = null;
    // for (let i = 0; i < obj.data.length; i += 1) {
    //   const pixel = obj.data[i];
    //   if (!max || pixel > max) {
    //     max = pixel;
    //   }
    // }
    // for (let i = 0; i < obj.data.length; i += 1) {
    //   // Set outside-of-scan pixels (-2000) to -1024 (air HU)
    //   // Workaround hard code fix, intercept may not be always -1024
    //   // TODO: improve it later
    //   const pixel = obj.data[i] !== -3024 ? obj.data[i] : -1024;
    //   // const pixel = obj.data[i];
    //   if (!min || pixel < min) {
    //     min = pixel;
    //   }
    // }

    if (!this.myCanvasRef.current) {
      console.log("this.myCanvasRef is not ready, return");
      return;
    }

    // const c = this.myCanvasRef.current; // document.getElementById("myCanvas");
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    // Create context from canvas
    const ctx = c.getContext("2d");
    // Create ImageData object
    if (!ctx) {
      return;
    }
    const imgData = ctx.createImageData(width, height);
    const { data } = imgData; // .data; // width x height x 4 (RGBA), Uint8ClampedArray

    if (!ifRGB) {
      const delta = max - min;
      // Create array view
      const array = new Uint8ClampedArray(obj.data.length);
      for (let i = 0; i < obj.data.length; i += 1) {
        // normalization
        array[i] = ((obj.data[i] - min) * 255) / delta;
      }
      for (let i = 0, k = 0; i < data.byteLength; i += 4, k += 1) {
        data[i] = array[k];
        data[i + 1] = array[k];
        data[i + 2] = array[k];
        data[i + 3] = 255;
      }
    } else if (rgbMode === 0) {
      // if 3 channels, pixel array'order is at Tag (0028, 0006)
      // Planar Configuration = 0 -> R1, G1, B1, R2, G2, B2, …
      // Planar Configuration = 1 -> R1, R2, R3, …, G1, G2, G3, …, B1, B2, B3
      const array = obj.data;
      for (let i = 0, k = 0; i < data.byteLength; i += 1, k += 1) {
        data[i] = array[k];
        if ((i + 2) % 4 === 0) {
          data[i + 1] = 255;
          i += 1;
        }
      }
    } else {
      // Note: tested. https://barre.dev/medical/samples/US-RGB-8-epicard
      const array = obj.data;
      const pixelCount = array.length / 3;
      for (let i = 0, k = 0; i < data.byteLength; i += 1, k += 1) {
        // data[i] = array[k];

        const j = Math.floor(i / 4); // jth pixel, start from 0
        if ((i + 1) % 4 === 1) {
          // r
          data[i] = array[j];
        } else if ((i + 1) % 4 === 2) {
          // g
          data[i] = array[j + pixelCount];
        } else if ((i + 1) % 4 === 3) {
          // b
          data[i] = array[j + pixelCount * 2];

          data[i + 1] = 255;
          i += 1;
        }
      }
    }

    // console.log("fill data to ctx's imagedata done, then draw our imagedata onto the canvas")
    ctx.putImageData(imgData, 0, 0);

    const scale = this.resizeTotFit(width, height);
    if (scale !== 1) {
      console.log("scale:", scale);
    }
    const c2: any = this.myCanvasRef.current;
    c2.width = width / scale;
    c2.height = height / scale;
    const ctx2 = c2.getContext("2d");
    // ctx2.scale(1 / scale, 1 / scale); is equal to ctx2.drawImage(c, 0, 0)
    ctx2.drawImage(c, 0, 0, c2.width, c2.height);
  };

  onOpenFileURLs(fileURLStr: string) {
    // const filePath = paths[1];
    // file:///fjdas;fjsajfajsk;lf
    const files = fileURLStr.split("file://");
    files.sort((a, b) => {
      return a.localeCompare(b);
    });
    console.log("sorted files:", files);
    this.files = [];
    files.forEach((file, index) => {
      if (index !== 0) {
        this.files.push(`file://${file}`);
      }
    });
    this.setState({
      totalFiles: this.files.length,
      currFileNo: 1,
    });

    this.fetchFile(this.files[0]);
  }

  fetchFile = (url: string) => {
    this.setState({
      currFilePath: decodeURI(url),
    });

    if (!this.checkDicomNameAndResetInvalid(url)) {
      return;
    }

    if (url.indexOf("file://") === 0) {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = () => {
        const arrayBuffer = xhr.response;
        this.renderImage(arrayBuffer);
      };
      xhr.send();
    } else {
      // NOTE: copy from https://github.com/my-codeworks/tiff-viewer-extension/blob/master/background.js#L29
      // TODO: figure it out why using arraybuffer will fail
      console.log("Starting XHR request for", url);
      const request = new XMLHttpRequest();
      request.open("GET", url, false);
      request.overrideMimeType("text/plain; charset=x-user-defined");
      request.send();
      console.log("Finished XHR request");
      const data = request.responseText;
      let buffer;
      let view: DataView;
      let a_byte;
      buffer = new ArrayBuffer(data.length);
      view = new DataView(buffer);
      data.split("").forEach((c, i) => {
        a_byte = c.charCodeAt(0);
        view.setUint8(i, a_byte & 0xff);
      });
      const buffer2 = view.buffer;
      this.renderImage(buffer2);
    }
  };

  switchImage = (value: number) => {
    this.setState({
      currFileNo: value,
    });

    const newFile = this.files[value - 1];
    console.log("switch to image:", value, newFile);

    if (!this.isOnlineMode) {
      this.loadFile(newFile);
    } else {
      this.fetchFile(newFile);
    }
  };

  checkDicomNameAndResetInvalid(name: string) {
    if (
      name.toLowerCase().endsWith(".dcm") === false &&
      name.toLowerCase().endsWith(".dicom") === false
    ) {
      console.log("not dicom file");
      const c2: any = this.myCanvasRef.current;
      if (c2) {
        const ctx2 = c2.getContext("2d");
        ctx2.clearRect(0, 0, c2.width, c2.height);
      }

      this.setState({
        ...emptyFile,
        hasDICOMExtension: false,
      });

      return false;
    }

    this.setState({
      hasDICOMExtension: true,
    });

    return true;
  }

  /* eslint-disable */
  loadFile(file: any) {
    this.setState({
      currFilePath: file.name,
    });

    if (!this.checkDicomNameAndResetInvalid(file.name)) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const fileContent = reader.result;
        this.renderImage(fileContent);
      } catch (e) {
        console.log("parse dicom error:", e);
      }
    };
    reader.onabort = () => console.log("file reading was aborted");
    // e.g. "drag a folder" will fail to read
    reader.onerror = () => console.log("file reading has failed");
    reader.readAsArrayBuffer(file);
  }

  onDropFile = (acceptedFiles: any[]) => {
    if (acceptedFiles.length > 0) {
      acceptedFiles.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      this.isOnlineMode = false;
      this.files = acceptedFiles;
      this.setState({
        totalFiles: this.files.length,
        currFileNo: 1,
      });
      this.loadFile(this.files[0]);
    }
  };

  handleSwitchFrame = (
    e: React.SyntheticEvent<HTMLElement, Event>,
    obj: DropdownProps
  ) => {
    const value = obj.value as number;

    console.log("switch frame:", value);

    this.setState({
      currFrameIndex: value,
    });
    this.renderFrame(this.currentImage, value);
  };

  resizeTotFit(width: number, height: number) {
    let scale = 1;
    const size = {
      maxWidth: 1280,
      maxHeight: 1024,
    };
    if (width <= size.maxWidth && height <= size.maxHeight) {
      return scale;
    }
    const scaleW = width / size.maxWidth;
    const scaleH = height / size.maxHeight;
    scale = scaleW >= scaleH ? scaleW : scaleH;

    return scale;
  }

  onKeyDown = (keyName: string) => {
    const { totalFiles, currFileNo } = this.state;
    let newFileNo = currFileNo;
    if (totalFiles > 1) {
      if (keyName === "right") {
        newFileNo += 1;
        if (newFileNo > totalFiles) {
          return;
        }
      } else if (keyName === "left") {
        newFileNo -= 1;
        if (newFileNo < 1) {
          return;
        }
      }
    } else {
      return;
    }

    this.switchImage(newFileNo);
  };

  render() {
    const {
      currFilePath,
      multiFrameInfo,
      frameIndexes,
      currFrameIndex,
      ifWindowCenterMode,
      windowCenter,
      windowWidth,
      max,
      min,
      resX,
      resY,
      photometric,
      modality,
      currFileNo,
      totalFiles,
      hasDICOMExtension,
    } = this.state;
    let info = "[meta]";
    info += ` modality:${modality};photometric:${photometric}`;
    if (resX && resY) {
      info += ` resolution:${resX}x${resY}`;
    }
    if (multiFrameInfo) {
      info += `; ${multiFrameInfo}`;
    }
    return (
      <Hotkeys
        allowRepeat
        keyName="right,left"
        onKeyDown={this.onKeyDown}
        // onKeyUp={this.onKeyUp.bind(this)}
      >
        <div className="flex-container">
          <div>
            <div className="flex-container">
              <div>
                DICOM Image Viewer (feat: 1. click DICOM url 2. click extension
                icon to open viewer page to load files/folder 3. drag any DICOM
                file into Chrome without opening viewer first
              </div>
            </div>
            <div>
              <div className="flex-container">
                <Dropzone
                  preventDropOnDocument={false}
                  style={dropZoneStyle}
                  getDataTransferItems={(evt) => fromEvent(evt)}
                  onDrop={this.onDropFile}
                >
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <p>
                        {" "}
                        Try dropping DICOM image files/folder here, <br />
                        or click here to select files to view. <br />
                        You need to enable file url access in extenstion DETAILS
                        setting page.
                      </p>
                    </div>
                  </div>
                </Dropzone>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {info}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div>
                  <Form>
                    <Form.Field>
                      <Checkbox
                        radio
                        label="Window Center Mode"
                        name="checkboxRadioGroup"
                        value="center"
                        checked={ifWindowCenterMode}
                        onChange={this.handleNormalizeModeChange}
                      />
                      {` c:${windowCenter};w:${windowWidth}`}
                    </Form.Field>
                    <Form.Field>
                      <Checkbox
                        radio
                        label="Max/Min Mode"
                        name="checkboxRadioGroup"
                        value="max"
                        checked={!ifWindowCenterMode}
                        onChange={this.handleNormalizeModeChange}
                      />
                      {` max:${max};min:${min}`}
                    </Form.Field>
                  </Form>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <div>
                    {" "}
                    {frameIndexes.length > 1 ? (
                      <Dropdown
                        placeholder="Switch Frame"
                        selection
                        onChange={this.handleSwitchFrame}
                        options={frameIndexes}
                        value={currFrameIndex}
                      />
                    ) : null}{" "}
                  </div>{" "}
                </div>{" "}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              {" "}
              {currFilePath || null}{" "}
            </div>{" "}
            {totalFiles > 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 600 }}>
                  {`[support right/left key] total:${totalFiles},current:${currFileNo}`}
                  <Slider
                    value={currFileNo}
                    step={1}
                    min={1}
                    max={totalFiles}
                    onChange={this.switchImage}
                  />
                </div>
              </div>
            ) : null}
            {hasDICOMExtension ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <canvas ref={this.myCanvasRef} width={128} height={128} />
              </div>
            ) : null}
          </div>
        </div>
      </Hotkeys>
    );
  }
}

export default App;
