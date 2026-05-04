# Rasengan Template Notes

## TouchDesigner Setup

1. Open TouchDesigner (2023.11 or later)
2. Create a new network or open your existing `.tox`
3. Add a **WebSocket DAT** at the path `/project1/websocket1`:
   - Mode: **Server**
   - Network Port: `9980` (must match `TD_WS_PORT` in `.env`)
   - Active: **On**
4. Add a **DAT Execute** connected to the WebSocket DAT
5. Paste the contents of `td/scripts/param_bind.py` into the DAT Execute

## Expected Parameters

The COMP at `/project1/rasengan` must have these custom parameters:

| ID        | Type   | Range         | Notes                        |
|-----------|--------|---------------|------------------------------|
| spin      | Float  | 0 – 5         | Rotation speed multiplier    |
| scale     | Float  | 0.1 – 3.0     | Overall scale                |
| intensity | Float  | 0 – 1         | Effect intensity             |
| hue       | Float  | 0 – 360       | Hue offset in degrees        |
| palmX     | Float  | 0 – 1         | AR hand tracking X (driven by Nexus) |
| palmY     | Float  | 0 – 1         | AR hand tracking Y (driven by Nexus) |

## Testing

Once setup is complete and Nexus is running:

1. Start Nexus: `pnpm dev`
2. Click **Connect** in the UI
3. Type the path to your `.tox` file and click **Load**
4. Move the sliders — parameters should update in real time in TD
5. Enable AR mode (LiveCanvas) — palm position drives palmX/palmY automatically
