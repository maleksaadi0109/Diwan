import { PoemImportProvider } from "./types";
import { AldewanProvider } from "./AldewanProvider";
import { LocalCorpusProvider } from "./LocalCorpusProvider";
import { MizanAlArabProvider } from "./MizanAlArabProvider";

export * from "./types";
export * from "./AldewanProvider";
export * from "./LocalCorpusProvider";
export * from "./MizanAlArabProvider";

export const AVAILABLE_PROVIDERS: PoemImportProvider[] = [
  new MizanAlArabProvider(),
  new AldewanProvider(),
  new LocalCorpusProvider(),
];
