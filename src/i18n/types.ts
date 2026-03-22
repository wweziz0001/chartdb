import type { en } from './locales/en';

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Record<string, unknown>
        ? DeepPartial<T[K]>
        : T[K];
};

export type LanguageTranslation = DeepPartial<typeof en>;

export type LanguageMetadata = {
    name: string;
    nativeName: string;
    code: string;
};
