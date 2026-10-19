(function () {
  var KEY = 'zv_cookie_choice'
  try { if (localStorage.getItem(KEY)) return } catch (e) { return }
  var bar = document.createElement('div')
  bar.className = 'cookie-bar'
  bar.setAttribute('role', 'dialog')
  bar.setAttribute('aria-label', 'Cookie notice')
  bar.innerHTML = '<p>This site stores your cookie choice on this device. Optional analytics only run after you accept, and only if an ID is configured. <a href="/legal/cookies.html">Cookie notice</a></p>'
    + '<button type="button" data-c="essential">Essential only</button>'
    + '<button type="button" class="yes" data-c="all">Accept</button>'
  bar.addEventListener('click', function (e) {
    var choice = e.target && e.target.getAttribute('data-c')
    if (!choice) return
    try { localStorage.setItem(KEY, choice) } catch (err) {}
    bar.remove()
  })
  document.body.appendChild(bar)
})()
