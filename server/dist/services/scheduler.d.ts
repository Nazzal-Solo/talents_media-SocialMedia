export declare class Scheduler {
    private automationService;
    private intervalId;
    constructor();
    start(): void;
    stop(): void;
    private runDaily;
    triggerNow(): Promise<void>;
}
//# sourceMappingURL=scheduler.d.ts.map