const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

// Square canvas for better mobile portrait display
canvas.width = 576
canvas.height = 576

const collisionsMap = []
for (let i = 0; i < collisions.length; i += 70) {
  collisionsMap.push(collisions.slice(i, 70 + i))
}

const battleZonesMap = []
for (let i = 0; i < battleZonesData.length; i += 70) {
  battleZonesMap.push(battleZonesData.slice(i, 70 + i))
}

const charactersMap = []
for (let i = 0; i < charactersMapData.length; i += 70) {
  charactersMap.push(charactersMapData.slice(i, 70 + i))
}
console.log(charactersMap)

const boundaries = []
const offset = {
  x: -735,
  y: -650
}

collisionsMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

const battleZones = []

battleZonesMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      battleZones.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

const characters = []
const villagerImg = new Image()
villagerImg.src = './img/villager/Idle.png'

const oldManImg = new Image()
oldManImg.src = './img/oldMan/Idle.png'

charactersMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    // 1026 === villager
    if (symbol === 1026) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: villagerImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          animate: true,
          dialogue: ['...', 'Hey mister, have you seen my Doggochu?']
        })
      )
    }
    // 1031 === oldMan
    else if (symbol === 1031) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: oldManImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          dialogue: ['My bones hurt.'],
          initiatesBattle: true
        })
      )
    }

    if (symbol !== 0) {
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
    }
  })
})

const image = new Image()
image.src = './img/Pellet Town.png'

const foregroundImage = new Image()
foregroundImage.src = './img/foregroundObjects.png'

const playerDownImage = new Image()
playerDownImage.src = './img/playerDown.png'

const playerUpImage = new Image()
playerUpImage.src = './img/playerUp.png'

const playerLeftImage = new Image()
playerLeftImage.src = './img/playerLeft.png'

const playerRightImage = new Image()
playerRightImage.src = './img/playerRight.png'

const player = new Sprite({
  position: {
    x: canvas.width / 2 - 192 / 4 / 2,
    y: canvas.height / 2 - 68 / 2
  },
  image: playerDownImage,
  frames: {
    max: 4,
    hold: 10
  },
  sprites: {
    up: playerUpImage,
    left: playerLeftImage,
    right: playerRightImage,
    down: playerDownImage
  }
})

const background = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: image
})

const foreground = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: foregroundImage
})

const keys = {
  w: {
    pressed: false
  },
  a: {
    pressed: false
  },
  s: {
    pressed: false
  },
  d: {
    pressed: false
  }
}

const movables = [
  background,
  ...boundaries,
  foreground,
  ...battleZones,
  ...characters
]
const renderables = [
  background,
  ...boundaries,
  ...battleZones,
  ...characters,
  player,
  foreground
]

const battle = {
  initiated: false
}

let animationId = null

function animate() {
  animationId = window.requestAnimationFrame(animate)
  renderables.forEach((renderable) => {
    renderable.draw()
  })

  let moving = true
  player.animate = false

  if (battle.initiated) return

  // activate a battle
  if (keys.w.pressed || keys.a.pressed || keys.s.pressed || keys.d.pressed) {
    for (let i = 0; i < battleZones.length; i++) {
      const battleZone = battleZones[i]
      const overlappingArea =
        (Math.min(
          player.position.x + player.width,
          battleZone.position.x + battleZone.width
        ) -
          Math.max(player.position.x, battleZone.position.x)) *
        (Math.min(
          player.position.y + player.height,
          battleZone.position.y + battleZone.height
        ) -
          Math.max(player.position.y, battleZone.position.y))
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: battleZone
        }) &&
        overlappingArea > (player.width * player.height) / 2 &&
        Math.random() < 0.01
      ) {
        // deactivate current animation loop
        window.cancelAnimationFrame(animationId)

        audio.Map.stop()
        audio.initBattle.play()
        audio.battle.play()

        battle.initiated = true
        gsap.to('#overlappingDiv', {
          opacity: 1,
          repeat: 3,
          yoyo: true,
          duration: 0.4,
          onComplete() {
            gsap.to('#overlappingDiv', {
              opacity: 1,
              duration: 0.4,
              onComplete() {
                // activate a new animation loop
                initBattle()
                animateBattle()
                gsap.to('#overlappingDiv', {
                  opacity: 0,
                  duration: 0.4
                })
              }
            })
          }
        })
        break
      }
    }
  }

  if (keys.w.pressed && lastKey === 'w') {
    player.animate = true
    player.image = player.sprites.up

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: 3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y + 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.y += 3
      })
  } else if (keys.a.pressed && lastKey === 'a') {
    player.animate = true
    player.image = player.sprites.left

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x + 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.x += 3
      })
  } else if (keys.s.pressed && lastKey === 's') {
    player.animate = true
    player.image = player.sprites.down

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: -3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y - 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.y -= 3
      })
  } else if (keys.d.pressed && lastKey === 'd') {
    player.animate = true
    player.image = player.sprites.right

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: -3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x - 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving)
      movables.forEach((movable) => {
        movable.position.x -= 3
      })
  }
}
animate()

let lastKey = ''
window.addEventListener('keydown', (e) => {
  if (player.isInteracting) {
    switch (e.key) {
      case ' ':
        player.interactionAsset.dialogueIndex++

        const { dialogueIndex, dialogue } = player.interactionAsset
        if (dialogueIndex <= dialogue.length - 1) {
          document.querySelector('#characterDialogueBox').innerHTML =
            player.interactionAsset.dialogue[dialogueIndex]
          return
        }

        // finish conversation
        player.isInteracting = false
        player.interactionAsset.dialogueIndex = 0
        document.querySelector('#characterDialogueBox').style.display = 'none'
        // start a battle (chess scene) after conversation only if this NPC initiates battles
        if (player.interactionAsset && player.interactionAsset.initiatesBattle) {
          const prompt = document.getElementById('startBattlePrompt')
          if (prompt) {
            prompt.style.display = 'block'
          } else {
            // fallback to immediate start if prompt not found
            try { window.cancelAnimationFrame(animationId) } catch (e) {}
            audio.Map.stop()
            audio.initBattle.play()
            audio.battle.play()
            battle.initiated = true
            gsap.to('#overlappingDiv', {
              opacity: 1,
              repeat: 3,
              yoyo: true,
              duration: 0.4,
              onComplete() {
                gsap.to('#overlappingDiv', {
                  opacity: 1,
                  duration: 0.4,
                  onComplete() {
                    initBattle()
                    animateBattle()
                    gsap.to('#overlappingDiv', { opacity: 0, duration: 0.4 })
                  }
                })
              }
            })
          }
        }

        break
      case 'x':
      case 'X':
        // pressing X during conversation immediately starts a battle
        player.isInteracting = false
        player.interactionAsset.dialogueIndex = 0
        document.querySelector('#characterDialogueBox').style.display = 'none'

        try { window.cancelAnimationFrame(animationId) } catch (err) {}
        audio.Map.stop()
        audio.initBattle.play()
        audio.battle.play()
        battle.initiated = true
        gsap.to('#overlappingDiv', {
          opacity: 1,
          repeat: 3,
          yoyo: true,
          duration: 0.4,
          onComplete() {
            gsap.to('#overlappingDiv', {
              opacity: 1,
              duration: 0.4,
              onComplete() {
                initBattle()
                animateBattle()
                gsap.to('#overlappingDiv', { opacity: 0, duration: 0.4 })
              }
            })
          }
        })
        break
    }
    return
  }

  switch (e.key) {
    case ' ':
      if (!player.interactionAsset) return

      // beginning the conversation
      const firstMessage = player.interactionAsset.dialogue[0]
      document.querySelector('#characterDialogueBox').innerHTML = firstMessage
      document.querySelector('#characterDialogueBox').style.display = 'flex'
      player.isInteracting = true
      break
    case 'w':
      keys.w.pressed = true
      lastKey = 'w'
      break
    case 'a':
      keys.a.pressed = true
      lastKey = 'a'
      break

    case 's':
      keys.s.pressed = true
      lastKey = 's'
      break

    case 'd':
      keys.d.pressed = true
      lastKey = 'd'
      break
  }
})

window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'w':
      keys.w.pressed = false
      break
    case 'a':
      keys.a.pressed = false
      break
    case 's':
      keys.s.pressed = false
      break
    case 'd':
      keys.d.pressed = false
      break
  }
})

let clicked = false
addEventListener('click', () => {
  if (!clicked) {
    audio.Map.play()
    clicked = true
  }
})

// Mobile control mapping: map on-screen buttons to existing input handling.
function synthKeyDown(key) {
  // dispatch a keyboard event so existing handlers react (e.g., space for interaction)
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}
function synthKeyUp(key) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }))
}

function bindButton(buttonId, onDown, onUp) {
  const btn = document.getElementById(buttonId)
  if (!btn) {
    console.warn('Button not found:', buttonId)
    return
  }
  // Use { passive: false } to allow preventDefault on touch events
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onDown()
  }, { passive: false })
  
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    onDown()
  })
  
  btn.addEventListener('touchend', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onUp()
  }, { passive: false })
  
  btn.addEventListener('touchcancel', (e) => {
    onUp()
  })
  
  btn.addEventListener('mouseup', (e) => {
    onUp()
  })
  
  btn.addEventListener('mouseleave', (e) => {
    onUp()
  })
}

// Initialize mobile controls after DOM is ready
function initMobileControls() {
  // D-pad - directly set the keys object and lastKey
  bindButton('btn-up', () => { keys.w.pressed = true; lastKey = 'w' }, () => { keys.w.pressed = false })
  bindButton('btn-left', () => { keys.a.pressed = true; lastKey = 'a' }, () => { keys.a.pressed = false })
  bindButton('btn-down', () => { keys.s.pressed = true; lastKey = 's' }, () => { keys.s.pressed = false })
  bindButton('btn-right', () => { keys.d.pressed = true; lastKey = 'd' }, () => { keys.d.pressed = false })

  // Action buttons: map A -> space (interact). Others dispatch custom key events for future hooks.
  bindButton('btn-A', () => synthKeyDown(' '), () => synthKeyUp(' '))
  bindButton('btn-B', () => synthKeyDown('b'), () => synthKeyUp('b'))
  bindButton('btn-X', () => synthKeyDown('x'), () => synthKeyUp('x'))
  bindButton('btn-Y', () => synthKeyDown('y'), () => synthKeyUp('y'))
}

// Call immediately since scripts are at bottom of HTML (DOM should be ready)
initMobileControls()

// Also try again on DOMContentLoaded in case timing is off
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileControls)
}

// When showing mobile controls on smaller screens, ensure pointer events are active.
function updateMobileControlsVisibility() {
  const mc = document.getElementById('mobileControls')
  if (!mc) return
  const show = window.innerWidth <= 900 || window.matchMedia('(orientation: portrait)').matches
  mc.style.display = show ? 'flex' : 'none'
}
window.addEventListener('resize', updateMobileControlsVisibility)
updateMobileControlsVisibility()

// Start-battle prompt handlers
function startBattleConfirmed() {
  const prompt = document.getElementById('startBattlePrompt')
  if (prompt) prompt.style.display = 'none'

  try {
    window.cancelAnimationFrame(animationId)
  } catch (e) {}

  audio.Map.stop()
  audio.initBattle.play()
  audio.battle.play()

  battle.initiated = true
  gsap.to('#overlappingDiv', {
    opacity: 1,
    repeat: 3,
    yoyo: true,
    duration: 0.4,
    onComplete() {
      gsap.to('#overlappingDiv', {
        opacity: 1,
        duration: 0.4,
        onComplete() {
          // activate a new animation loop (chess)
          initBattle()
          animateBattle()
          gsap.to('#overlappingDiv', {
            opacity: 0,
            duration: 0.4
          })
        }
      })
    }
  })
}

function startBattleCanceled() {
  const prompt = document.getElementById('startBattlePrompt')
  if (prompt) prompt.style.display = 'none'
}

document.addEventListener('DOMContentLoaded', () => {
  const yes = document.getElementById('startBattleYes')
  const no = document.getElementById('startBattleNo')
  if (yes) {
    yes.addEventListener('click', startBattleConfirmed)
    yes.addEventListener('touchstart', (e) => { if (e && e.cancelable) e.preventDefault(); startBattleConfirmed() })
  }
  if (no) {
    no.addEventListener('click', startBattleCanceled)
    no.addEventListener('touchstart', (e) => { if (e && e.cancelable) e.preventDefault(); startBattleCanceled() })
  }
})
