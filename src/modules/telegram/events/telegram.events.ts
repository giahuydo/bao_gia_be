export class QuotationStatusChangedEvent {
  constructor(
    public readonly quotationId: string,
    public readonly quotationNumber: string,
    public readonly title: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly changedBy: string,
    public readonly total?: number,
    public readonly customerName?: string,
  ) {}
}

export class IngestionJobCompletedEvent {
  constructor(
    public readonly jobId: string,
    public readonly status: 'completed' | 'failed' | 'dead_letter',
    public readonly quotationId?: string,
    public readonly quotationNumber?: string,
    public readonly error?: string,
  ) {}
}

export class ReviewRequestCreatedEvent {
  constructor(
    public readonly reviewId: string,
    public readonly type: string,
    public readonly requestedByName: string,
    public readonly quotationId?: string,
    public readonly quotationNumber?: string,
    public readonly assignedToName?: string,
  ) {}
}
