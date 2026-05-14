import React, { useMemo, useState } from "react";
import {
  ViroARScene,
  ViroPolyline,
  ViroAmbientLight,
  ViroMaterials,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";

const MAIN_HORIZONTAL_SCALE = 0.54;
const DIGITAL_HORIZONTAL_SCALE = 0.74;
const VERTICAL_SCALE = 0.14;

type NavigationSceneProps = {
  sceneNavigator: {
    viroAppProps: {
      path: Array<any>;
      lineColor: string;
      yOffset: number | string;
      startNode?: any;
    };
  };
};

export function NavigationScene(props: NavigationSceneProps) {
  const [trackingState, setTrackingState] = useState(
    ViroTrackingStateConstants.TRACKING_UNAVAILABLE
  );

  const {
    path,
    lineColor,
    yOffset,
    startNode,
  } = props.sceneNavigator.viroAppProps;

  useMemo(() => {
    ViroMaterials.createMaterials({
      universityRed: {
        diffuseColor: lineColor || "#B22222",
        lightingModel: "Constant",
      },
    });
  }, [lineColor]);

  const safeStart = startNode || (path && path[0]);
  const resolvedYOffset = parseFloat(String(yOffset ?? -1.2));
  const isDigital = path && path[0]?.nodeID?.includes("Digital");
  const CURRENT_H_SCALE = isDigital ? DIGITAL_HORIZONTAL_SCALE : MAIN_HORIZONTAL_SCALE;

  const points = useMemo(() => {
    if (!path || path.length < 2) return [];

    return path.map((node) => {
      const rawX = parseFloat(node.posX || 0) - parseFloat(safeStart?.posX || 0);
      const rawZ = parseFloat(node.posZ || 0) - parseFloat(safeStart?.posZ || 0);
      const rawY = parseFloat(node.posY || 0) - parseFloat(safeStart?.posY || 0);

      const x = rawX * -CURRENT_H_SCALE;
      const z = rawZ * CURRENT_H_SCALE;
      const y = rawY * VERTICAL_SCALE + resolvedYOffset;

      return [x, y, z];
    });
  }, [path, safeStart, resolvedYOffset, CURRENT_H_SCALE]);

  const _onTrackingUpdated = (state: number) => {
    setTrackingState(state);
    if (state === ViroTrackingStateConstants.TRACKING_NORMAL) {
      console.log("[ARISE] World-Lock established.");
    }
  };

  return (
    <ViroARScene
      onTrackingUpdated={_onTrackingUpdated}
      anchorDetectionTypes={["PlanesHorizontal"]}
    >
      <ViroAmbientLight color="#ffffff" />

      {points.length > 1 && trackingState === ViroTrackingStateConstants.TRACKING_NORMAL && (
        <ViroPolyline
          position={[0, 0, 0]}
          points={points}
          thickness={0.3}
          materials={["universityRed"]}
        />
      )}
    </ViroARScene>
  );
}
