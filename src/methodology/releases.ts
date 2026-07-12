import researchRelease from "@/methodology/releases/research-1.0.0.json";
import research110Release from "@/methodology/releases/research-1.1.0.json";
import research120Release from "@/methodology/releases/research-1.2.0.json";

export type MethodologyReleaseChannel = "stub" | "research";

export interface MethodologyReleaseMetadata {
  readonly version: string;
  readonly channel: MethodologyReleaseChannel;
  readonly releasedOn: string;
  readonly sourceDocument: string;
  readonly summary: string;
  readonly retainedBestGuesses: readonly string[];
  readonly deliberateStubs: readonly string[];
  readonly rollbackVersion: string | null;
}

function freezeMetadata(
  metadata: MethodologyReleaseMetadata,
): MethodologyReleaseMetadata {
  return Object.freeze({
    ...metadata,
    retainedBestGuesses: Object.freeze([...metadata.retainedBestGuesses]),
    deliberateStubs: Object.freeze([...metadata.deliberateStubs]),
  });
}

const STUB_RELEASE = freezeMetadata({
  version: "stub-0.1.0",
  channel: "stub",
  releasedOn: "2026-06-21",
  sourceDocument: "planning/METHODOLOGY.md",
  summary:
    "Pre-release placeholder configuration retained for historic programs.",
  retainedBestGuesses: [],
  deliberateStubs: [
    "The complete methodology was not yet released as the active configuration.",
  ],
  rollbackVersion: null,
});

const RESEARCH_RELEASE = freezeMetadata(
  researchRelease as MethodologyReleaseMetadata,
);
const RESEARCH_110_RELEASE = freezeMetadata(
  research110Release as MethodologyReleaseMetadata,
);
const RESEARCH_120_RELEASE = freezeMetadata(
  research120Release as MethodologyReleaseMetadata,
);

export const METHODOLOGY_RELEASES: Readonly<
  Record<string, MethodologyReleaseMetadata>
> = Object.freeze({
  [STUB_RELEASE.version]: STUB_RELEASE,
  [RESEARCH_RELEASE.version]: RESEARCH_RELEASE,
  [RESEARCH_110_RELEASE.version]: RESEARCH_110_RELEASE,
  [RESEARCH_120_RELEASE.version]: RESEARCH_120_RELEASE,
});

export function methodologyReleaseFor(
  version: string,
): MethodologyReleaseMetadata {
  const release = METHODOLOGY_RELEASES[version];
  if (!release) {
    throw new Error(`Unknown methodology release "${version}"`);
  }
  return release;
}
