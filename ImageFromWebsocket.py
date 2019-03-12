#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Mar 10 19:42:56 2019

@author: lukas
"""

import asyncio
import websockets
import pickle
import numpy as np
import PIL.Image, os, config
import dnnlib.tflib as tflib
import hashlib, time
import base64
from io import BytesIO

# Initialize TensorFlow.
tflib.init_tf()

# Load pre-trained network.
_G, _D, Gs = pickle.load(open("/home/lukas/Documents/Py/2019-02-26-stylegan-faces-network.pkl", "rb"))
    # _G = Instantaneous snapshot of the generator. Mainly useful for resuming a previous training run.
    # _D = Instantaneous snapshot of the discriminator. Mainly useful for resuming a previous training run.
    # Gs = Long-term average of the generator. Yields higher-quality results than the instantaneous snapshot.


async def AvatarAI(websocket, path):
    busy = False
    async for message in websocket:
        message = message.replace('/', '')
        print(str(message))
        if(os.path.isfile('/home/lukas/Documents/stylegan/results/avatars/'+str(message)+'.png')):
            image = PIL.Image.open('/home/lukas/Documents/stylegan/results/avatars/'+str(message)+'.png')
            buffered = BytesIO()
            image.save(buffered, format="JPEG")
            await websocket.send(str(message)+'|'+str(base64.b64encode(buffered.getvalue())))
            return
        while(busy):
            time.sleep(1)
        # Pick latent vector.
        hs = hashlib.sha224(str(message).encode())
        hl = hs.digest()
        hs = ''
        for a in hl:
            hs += str(a)
        hs = int(hs)
        
        rnd = np.random.RandomState(hs%(2**32))
        latents = rnd.randn(1, Gs.input_shape[1])
        
        # Generate image.
        busy = True
        fmt = dict(func=tflib.convert_images_to_uint8, nchw_to_nhwc=True)
        images = Gs.run(latents, None, truncation_psi=1, randomize_noise=False, 
                        output_transform=fmt,minibatch_size=10)
        busy = False
        image = PIL.Image.fromarray(images[0], 'RGB')
        #save locally
        string = 'avatars/'+str(message)+'.png'
        png_filename = os.path.join(config.result_dir, string)
        image.save(png_filename)
        #send to Websocket
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        await websocket.send(str(message)+'|'+str(base64.b64encode(buffered.getvalue())))

asyncio.get_event_loop().run_until_complete(
    websockets.serve(AvatarAI, '0.0.0.0', 8766))
print('Ready.')
asyncio.get_event_loop().run_forever()
