import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useState, type ReactNode } from "react";
import { nahZoom } from "./kamera";

export function NahKulisse({ basisZoom, children }: { basisZoom: number; children: ReactNode }) {
  const camera = useThree((s) => s.camera);
  const [nah, setNah] = useState(false), letzter = useRef(false);
  useFrame(() => {
    const neu = nahZoom(camera.zoom, basisZoom, letzter.current);
    if (neu !== letzter.current) { letzter.current = neu; setNah(neu); }
  }, -2);
  return nah ? null : <>{children}</>;
}
