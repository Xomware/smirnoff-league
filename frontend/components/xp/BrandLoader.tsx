import { IceBottleIcon } from "./icons";

// Styled only through .brand-loader, so a theme can restyle it from CSS.
export function BrandLoader() {
  return (
    <span className="brand-loader">
      <IceBottleIcon height={72} />
    </span>
  );
}
