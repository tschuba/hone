type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
};

export class DeviceServices {
  private readonly documentRef =
    typeof document === "undefined" ? null : document;
  private readonly navigatorRef =
    typeof navigator === "undefined" ? null : (navigator as WakeLockNavigator);
  private wakeLockSentinel: WakeLockSentinel | null = null;

  constructor(private readonly shouldHoldWakeLock: () => boolean) {}

  get supported() {
    return Boolean(this.navigatorRef?.wakeLock);
  }

  async requestWakeLock() {
    if (
      !this.supported ||
      !this.navigatorRef?.wakeLock ||
      !this.documentRef ||
      !this.shouldHoldWakeLock()
    ) {
      return;
    }

    if (this.wakeLockSentinel) {
      return;
    }

    try {
      this.wakeLockSentinel =
        await this.navigatorRef.wakeLock.request("screen");
      this.documentRef.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
    } catch {
      this.wakeLockSentinel = null;
    }
  }

  async releaseWakeLock() {
    this.documentRef?.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );

    if (!this.wakeLockSentinel) {
      return;
    }

    await this.wakeLockSentinel.release();
    this.wakeLockSentinel = null;
  }

  private handleVisibilityChange = async () => {
    if (this.documentRef?.visibilityState !== "visible") {
      await this.releaseWakeLock();
      return;
    }

    await this.releaseWakeLock();

    if (this.shouldHoldWakeLock()) {
      await this.requestWakeLock();
    }
  };
}
