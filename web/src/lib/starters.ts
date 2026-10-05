/**
 * One-click starters for the generate page.
 *
 * Each starter is a prompt plus a real Muse Gadgets target — modelled on what
 * the community actually builds (see the Musecases tracker) and kept inside
 * each board's capability matrix: an eInk board never promises audio, a
 * Cardputer never promises images, the Pi runs the Linux command surface.
 */

export type StarterTarget = { sdk: "esp32" | "linux"; board: string };

export type Starter = {
  id: string;
  title: string;
  blurb: string;
  prompt: string;
  target: StarterTarget;
};

export const MUSE_STARTERS: Starter[] = [
  {
    id: "round-desk-companion",
    title: "Round desk companion",
    blurb: "AMOLED face, push-to-talk, answers on screen",
    target: { sdk: "esp32", board: "waveshare-esp32-s3-touch-amoled-1.75" },
    prompt:
      "A round-screened Muse desk companion: answers and images on its 1.75-inch AMOLED face, push-to-talk voice notes, touch settings, a cloth-wrapped printed stand, USB-C powered.",
  },
  {
    id: "eink-status-board",
    title: "eInk status board",
    blurb: "Ambient, always-on, updates when status changes",
    target: { sdk: "esp32", board: "reterminal-e1001" },
    prompt:
      "An ambient eInk status board above the desk: Muse pushes the agent name, a status line and black-and-white images that stay on screen without power; one green button to refresh; USB-C.",
  },
  {
    id: "pocket-voice-terminal",
    title: "Pocket voice terminal",
    blurb: "Cardputer: hold GO to talk, replies scroll",
    target: { sdk: "esp32", board: "m5stack-cardputer-adv" },
    prompt:
      "A tiny Muse terminal on a Cardputer: hold GO to send a voice note, replies scroll past as text on the 1.14-inch screen, Esc opens settings; USB-C, no battery promises.",
  },
  {
    id: "pi-home-bridge",
    title: "Pi home bridge",
    blurb: "Linux SDK: Muse runs chores on your Pi",
    target: { sdk: "linux", board: "raspberry-pi" },
    prompt:
      "A Raspberry Pi 5 Muse gadget for the home: Muse runs shell chores and moves files on the machine, checks disk and temperature, and a small printed case keeps it tidy by the router.",
  },
];
