<template>
  <div class="wrapper" id="wrapper" @click.prevent="onUpEnterKey">
    <main>
      <article class="article" v-html="article"></article>
    </main>
  </div>
</template>

<script>
  import { ipcRenderer } from 'electron'
  import cheerio from 'cheerio'

  export default {
    name: 'main-page',
    data () {
      return {
        article: ''
      }
    },
    methods: {
      open (link) {
        this.$electron.shell.openExternal(link)
      },
      onUpEnterKey () {
        document.querySelector('body').scrollTop += 24
      }
    },
    created () {
      ipcRenderer.send('GET_NAROU_PAGE', 'http://ncode.syosetu.com/n9669bk/1/')

      ipcRenderer.on('RECEIVE_NAROU_PAGE', (event, data) => {
        const $ = cheerio.load(data)
        this.$data.article = $('#novel_honbun').html()
      })
    }
  }
</script>

<style>
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body { font-family: 'Source Sans Pro', sans-serif; }
</style>
<style scoped>
  .wrapper {
    background:
      radial-gradient(
        ellipse at top left,
        rgba(255, 255, 255, 1) 40%,
        rgba(229, 229, 229, .9) 100%
      );
    height: 100vh;
    padding: 0;
    width: 100vw;
  }

  .article {
    line-height: 24px;
  }
</style>
