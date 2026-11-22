"use client";

import type { SceneObject } from "./sceneConfig";
import GalaxyVisual from "./galaxy/GalaxyVisual";
import NebulaCloud from "./NebulaCloud";
import BlackHole from "./BlackHole";
import StarSystem from "./StarSystem";

export default function ObjectVisual({ obj }: { obj: SceneObject }) {
  switch (obj.kind) {
    case "galaxy":
      return <GalaxyVisual id={obj.id} radius={obj.radius} seed={obj.seed} position={obj.position} tilt={obj.tilt} />;
    case "nebula":
      return <NebulaCloud radius={obj.radius} seed={obj.seed} color={obj.color} />;
    case "black-hole":
      return (
        <>
          {obj.hostGalaxy && obj.hostRadius && <GalaxyVisual id={obj.hostGalaxy} radius={obj.hostRadius} seed={obj.seed} position={obj.position} />}
          <BlackHole radius={obj.radius} tilt={obj.tilt} color={obj.color} />
        </>
      );
    case "star-system":
      return <StarSystem radius={obj.radius} color={obj.color} />;
  }
}
