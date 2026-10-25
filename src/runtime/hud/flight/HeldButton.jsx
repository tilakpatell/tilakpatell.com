import TouchButton from '../TouchButton';

// A flight button that's held: the kit's TouchButton, keeping the finger
// till it lifts (so a thumb that drifts off Fire or Boost doesn't let go of
// it), saying `on` as it's pressed and `off` once it's let go, through one
// `onHold(value)`: Fire's true and false, the climb's way and 0. Let go
// with no event, too, when the window goes (TouchButton's blur).
//   HeldButton({ on = true, off = false, onHold, ...rest })   rest: TouchButton's (size, className, aria-*, children)
export default function HeldButton({ on = true, off = false, onHold, ...rest }) {
  return (
    <TouchButton
      {...rest}
      onPress={(e) => {
        e.preventDefault();
        onHold(on);
      }}
      onRelease={() => onHold(off)}
    />
  );
}
