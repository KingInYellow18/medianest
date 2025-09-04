export declare enum RequestStatus {
    PENDING = "pending",
    APPROVED = "approved",
    PROCESSING = "processing",
    PARTIALLY_AVAILABLE = "partially-available",
    AVAILABLE = "available",
    DENIED = "denied",
    FAILED = "failed"
}
export type MediaType = 'movie' | 'tv';
export interface SeasonRequest {
    seasonNumber: number;
    episodes?: number[];
    status: RequestStatus;
}
export interface MediaRequest {
    id: string;
    userId: string;
    mediaId: number;
    mediaType: MediaType;
    title: string;
    posterPath?: string;
    status: RequestStatus;
    tmdbId?: string;
    seasons?: SeasonRequest[];
    requestedAt: Date;
    approvedAt?: Date;
    availableAt?: Date;
    overseerrId?: string;
    deniedReason?: string;
    user?: {
        id: string;
        plexUsername: string;
        email?: string;
    };
}
export interface RequestSubmission {
    mediaId: number;
    mediaType: MediaType;
    seasons?: number[];
    episodes?: {
        [seasonNumber: number]: number[];
    };
}
export interface RequestStatusUpdate {
    requestId: string;
    status: RequestStatus;
    updatedAt: Date;
    message?: string;
}
export interface RequestFilters {
    status?: RequestStatus | 'all';
    mediaType?: MediaType | 'all';
    dateRange?: {
        start: Date;
        end: Date;
    };
    search?: string;
}
export interface RequestHistoryOptions {
    userId?: string;
    filters: RequestFilters;
    page: number;
    pageSize: number;
    sortBy: 'date' | 'title' | 'status';
    sortOrder: 'asc' | 'desc';
}
export interface RequestHistoryResponse {
    requests: MediaRequest[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}
//# sourceMappingURL=request.d.ts.map