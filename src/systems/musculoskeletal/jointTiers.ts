// The tiers of a structure that sits at a joint (ligaments and the cartilage
// kinds; M12 plan decision 6; musculoskeletal spec §5.2), each sorted by ID.
// Tier 1: the structures it names (`connects`, `attached_to`). Tier 2: + every
// ligament and cartilage at the same joint (`shares_joint_with`); none for a
// structure with no joint, so the panel's button says "Not part of a joint".
import type { KindTiers } from "../../graph/types";

export const jointTiers = (named: string) =>
  ({
    t1: { steps: [{ follow: named }], order: "id" },
    t2: { steps: [{ tier: "t1" }, { follow: "shares_joint_with" }], order: "id", requires: "member_of_joint" },
  }) as const satisfies KindTiers;
