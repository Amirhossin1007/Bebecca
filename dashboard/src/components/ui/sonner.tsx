import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useColorMode } from "lib/color-mode";

const Toaster = (props: ToasterProps) => {
  const { colorMode } = useColorMode();
  return (
    <Sonner
      theme={colorMode}
      className="toaster group"
      position="top-center"
      closeButton
      richColors
      {...props}
    />
  );
};

export { Toaster };
export { toast } from "sonner";
