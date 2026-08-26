import { PoemImportProvider } from "./types";
import { AldewanProvider } from "./AldewanProvider";
import { LocalCorpusProvider } from "./LocalCorpusProvider";

export * from "./types";
export * from "./AldewanProvider";
export * from "./LocalCorpusProvider";

export const AVAILABLE_PROVIDERS: PoemImportProvider[] = [
  new AldewanProvider(),
  new LocalCorpusProvider(),
];
