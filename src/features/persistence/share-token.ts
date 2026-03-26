const SHARED_DIAGRAM_PATH =
    /^\/shared\/diagrams\/[^/]+\/(?<shareToken>[^/]+)$/;
const SHARED_PROJECT_DIAGRAM_PATH =
    /^\/shared\/projects\/[^/]+\/(?<shareToken>[^/]+)\/diagrams\/[^/]+$/;
const SHARED_PROJECT_PATH =
    /^\/shared\/projects\/[^/]+\/(?<shareToken>[^/]+)$/;

export const getCurrentShareToken = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    const pathname = window.location.pathname;
    const match =
        pathname.match(SHARED_DIAGRAM_PATH) ??
        pathname.match(SHARED_PROJECT_DIAGRAM_PATH) ??
        pathname.match(SHARED_PROJECT_PATH);
    const shareToken = match?.groups?.shareToken?.trim();
    return shareToken ? shareToken : null;
};
