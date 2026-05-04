# param_bind.py
# Run this in a DAT Execute (Script DAT) in TouchDesigner.
# The WebSocket DAT is assumed to be named 'websocket1' and lives at /project1/websocket1.
# Incoming message format (from Nexus):
#   { "type": "param_update", "templateId": "rasengan", "parameterId": "spin", "value": 1.5 }
#   { "type": "hand_tracking", "palmX": 0.42, "palmY": 0.58, "confidence": 1.0, "detected": true }
# The target COMP is assumed to be /project1/rasengan (adjust COMP_PATH as needed).

import json

COMP_PATH = '/project1/rasengan'
TEMPLATE_ID = 'rasengan'

def onReceiveText(dat, rowIndex, message, bytes, timeStamp, address, webSocket):
    try:
        msg = json.loads(message)
        msg_type = msg.get('type')

        if msg_type == 'param_update':
            if msg.get('templateId') != TEMPLATE_ID:
                return
            param_id = msg.get('parameterId')
            value = msg.get('value')
            if param_id is None or value is None:
                return
            comp = op(COMP_PATH)
            if comp is None:
                print(f'[Nexus] COMP not found: {COMP_PATH}')
                return
            par = getattr(comp.par, param_id, None)
            if par is None:
                print(f'[Nexus] Unknown parameter: {param_id}')
                return
            par.val = value

        elif msg_type == 'hand_tracking':
            comp = op(COMP_PATH)
            if comp is None:
                return
            palm_x = msg.get('palmX', 0.5)
            palm_y = msg.get('palmY', 0.5)
            detected = msg.get('detected', False)
            if detected:
                par_x = getattr(comp.par, 'palmX', None)
                par_y = getattr(comp.par, 'palmY', None)
                if par_x is not None:
                    par_x.val = palm_x
                if par_y is not None:
                    par_y.val = palm_y

        elif msg_type == 'ping':
            webSocket.sendText(json.dumps({'type': 'pong'}))

    except json.JSONDecodeError as e:
        print(f'[Nexus] JSON decode error: {e}')
    except Exception as e:
        print(f'[Nexus] Error in onReceiveText: {e}')
