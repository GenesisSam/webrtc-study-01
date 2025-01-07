import { io, Socket } from "socket.io-client";
import { Users, UserInfo } from "../types/user";

export type ConnectionState = "disconnected" | "connecting" | "connected";

export class WebRTCService {
  private peerConnection: RTCPeerConnection;
  private socket: Socket;
  private dataChannel: RTCDataChannel | null = null;
  private messageHandler: ((message: string) => void) | null = null;
  private connectionStateHandler: ((state: ConnectionState) => void) | null =
    null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private currentRoomId: string | undefined;
  private usersHandler: ((users: Users) => void) | null = null;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private hasRemoteDescription = false;

  constructor() {
    this.socket = io("http://localhost:3001");
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
      iceTransportPolicy: "all",
    });

    this.setupSocketListeners();
    this.setupPeerConnectionListeners();
    this.setupDataChannel();
  }

  private async processIceCandidateQueue() {
    while (this.iceCandidateQueue.length) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
          console.log("Queued ICE candidate added successfully");
        } catch (error) {
          console.error("Error adding queued ICE candidate:", error);
        }
      }
    }
  }

  private setupSocketListeners() {
    this.socket.on("offer", async ({ offer, from }) => {
      console.log("Received offer from:", from);
      try {
        this.hasRemoteDescription = false;
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        this.hasRemoteDescription = true;
        await this.processIceCandidateQueue();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.socket.emit("answer", {
          answer,
          roomId: this.currentRoomId,
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    this.socket.on("answer", async ({ answer, from }) => {
      console.log("Received answer from:", from);
      try {
        this.hasRemoteDescription = false;
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        this.hasRemoteDescription = true;
        await this.processIceCandidateQueue();
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    this.socket.on("ice-candidate", async ({ candidate, from }) => {
      console.log("Received ICE candidate from:", from);
      try {
        const iceCandidate = new RTCIceCandidate(candidate);
        if (this.hasRemoteDescription) {
          await this.peerConnection.addIceCandidate(iceCandidate);
          console.log("ICE candidate added immediately");
        } else {
          this.iceCandidateQueue.push(iceCandidate);
          console.log("ICE candidate queued");
        }
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    });

    this.socket.on("users", (users: Users) => {
      if (this.usersHandler) {
        this.usersHandler(users);
      }
    });

    this.socket.on("connect", () => {
      console.log("Socket connected");
      if (this.connectionStateHandler) {
        this.connectionStateHandler("connecting");
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected");
      if (this.connectionStateHandler) {
        this.connectionStateHandler("disconnected");
      }
    });
  }

  private setupPeerConnectionListeners() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event.candidate.candidate);
        this.socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId: this.currentRoomId,
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log(
        "Connection state changed:",
        this.peerConnection.connectionState
      );
      this.updateConnectionState();
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        this.peerConnection.iceConnectionState
      );
      this.updateConnectionState();
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log(
        "ICE gathering state:",
        this.peerConnection.iceGatheringState
      );
    };
  }

  private setupDataChannel() {
    // 호스트만 DataChannel을 생성하도록 수정
    this.peerConnection.ondatachannel = (event) => {
      console.log("Received remote data channel");
      this.dataChannel = event.channel;
      this.initDataChannelListeners();
    };
  }

  private initDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      if (this.messageHandler) {
        this.messageHandler(event.data);
      }
    };

    this.dataChannel.onopen = () => {
      console.log(
        "Data channel opened with state:",
        this.dataChannel?.readyState
      );
      this.updateConnectionState();
    };

    this.dataChannel.onclose = () => {
      console.log(
        "Data channel closed with state:",
        this.dataChannel?.readyState
      );
      this.updateConnectionState();
    };

    this.dataChannel.onerror = (error) => {
      console.error("Data channel error:", error);
      this.updateConnectionState();
    };
  }

  private updateConnectionState() {
    let state: ConnectionState = "disconnected";

    // Check peer connection state
    if (
      this.peerConnection.connectionState === "connected" &&
      this.peerConnection.iceConnectionState === "connected"
    ) {
      state = "connected";
    } else if (
      ["new", "connecting"].includes(this.peerConnection.connectionState) ||
      ["checking", "connected"].includes(this.peerConnection.iceConnectionState)
    ) {
      state = "connecting";
    }

    // Check data channel state if it exists
    if (this.dataChannel) {
      if (this.dataChannel.readyState === "open") {
        state = "connected";
      } else if (this.dataChannel.readyState === "connecting") {
        state = "connecting";
      }
    }

    if (this.connectionStateHandler) {
      this.connectionStateHandler(state);
    }
  }

  onConnectionStateChange(handler: (state: ConnectionState) => void) {
    this.connectionStateHandler = handler;
  }

  private handleError(error: Error) {
    console.error("WebRTC Error:", error);
    if (this.connectionStateHandler) {
      this.connectionStateHandler("disconnected");
    }
  }

  public getId(): string | undefined {
    return this.socket.id;
  }

  async createRoom() {
    try {
      await this.resetConnection();

      // ICE gathering 완료 대기를 위한 Promise
      const gatheringComplete = new Promise<void>((resolve) => {
        if (this.peerConnection.iceGatheringState === "complete") {
          resolve();
        } else {
          this.peerConnection.onicegatheringstatechange = () => {
            if (this.peerConnection.iceGatheringState === "complete") {
              resolve();
            }
          };
        }
      });

      // 호스트에서 DataChannel 생성
      this.dataChannel = this.peerConnection.createDataChannel(
        "messageChannel",
        {
          ordered: true,
          maxRetransmits: 3,
        }
      );
      this.initDataChannelListeners();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.currentRoomId = this.socket.id;
      this.socket.emit("join", this.socket.id);

      // ICE gathering 완료 대기
      await gatheringComplete;

      this.socket.emit("offer", {
        offer: this.peerConnection.localDescription,
        roomId: this.socket.id,
      });

      return this.socket.id;
    } catch (error) {
      this.handleError(error as Error);
      return null;
    }
  }

  async joinRoom(roomId: string) {
    try {
      this.currentRoomId = roomId;
      await this.resetConnection();

      // 게스트는 ondatachannel 이벤트만 대기
      this.peerConnection.ondatachannel = (event) => {
        console.log("Received remote data channel on join");
        this.dataChannel = event.channel;
        this.initDataChannelListeners();
      };

      this.socket.emit("join", roomId);
    } catch (error) {
      console.error("Error joining room:", error);
      this.handleError(error as Error);
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError(new Error("최대 재연결 시도 횟수를 초과했습니다."));
      return false;
    }

    try {
      this.reconnectAttempts++;
      await this.resetConnection();
      if (this.currentRoomId) {
        await this.joinRoom(this.currentRoomId);
      }
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  private async resetConnection() {
    this.hasRemoteDescription = false;
    this.iceCandidateQueue = [];
    this.peerConnection.close();
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
      iceTransportPolicy: "all",
    });
    this.setupPeerConnectionListeners();
    this.setupDataChannel();
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.dataChannel) {
      console.error("No data channel available");
      return false;
    }

    if (this.dataChannel.readyState !== "open") {
      console.error("Data channel state:", this.dataChannel.readyState);
      return false;
    }

    try {
      this.dataChannel.send(message);
      return true;
    } catch (error) {
      this.handleError(error as Error);
      return false;
    }
  }

  onMessage(handler: (message: string) => void) {
    this.messageHandler = handler;
  }

  onUsers(handler: (users: Users) => void) {
    this.usersHandler = handler;
  }

  updateUserInfo(nickname: string, personalColor: string) {
    this.socket.emit("update_user_info", {
      nickname,
      personalColor,
      roomId: this.currentRoomId,
    });
  }
}
