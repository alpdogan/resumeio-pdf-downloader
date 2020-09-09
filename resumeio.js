const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const request = require('request');
const sharp = require('sharp');

if(process.argv.length < 3){
    console.error("Please specify a resume.io link. i.e. https://resume.io/r/LXKF8wy6q")
    process.exit();
}

const arg = getResumeUrl(process.argv);
if(!arg.isValid){
    console.error("Please specify a valid resume.io link. i.e. https://resume.io/r/LXKF8wy6q")
    process.exit();
}

(async () => {
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.goto(arg.url, {  waitUntil:['domcontentloaded', 'networkidle0'] });
    const imageUrls = await page.evaluate(
        () =>  Array.from(document.querySelectorAll('*'))
                    .filter(elem => {
                        return elem.className.includes('--has-image');
                    }).map(elem => elem.style.backgroundImage.match(/\((.*?)\)/)[1].replace(/('|")/g,''))
      );

    console.log(imageUrls);
    let downloaded = [];
    imageUrls.map((img, index) => 
        download(img, `${index}.webp`, 
                () => onDownload(downloaded, index, imageUrls.length)
            )
        );
    await browser.close();
})();


function onDownload(downloaded, index, size){
    downloaded[index] = {
        file: `${index}.png`,
        converted: false
    };
    convert(downloaded, index, onConvert);
    console.log("downloaded", downloaded);
}

function onConvert(downloaded){
    let imgUrls = downloaded.map(img => img.file);
    printPdf(imgUrls);
}

function convert(downloaded, index, callback){
    sharp(`${index}.webp`)
        .toFile(`${index}.png`, (err, info) => {
            if(!err){
                downloaded[index].converted = true;
                console.log("converted", info);
            }
            var done = downloaded.filter(p => !p.converted).length === 0;
            if(done){
                callback(downloaded);
            }
        });
}

function getResumeUrl(argv){
    let pattern = /\/\/resume.io\/r\/\w+/gi;
    return {
        isValid: pattern.test(argv[2]),
        url: argv[2]
    }
}

function printPdf(images){
    const doc = new PDFDocument({
        autoFirstPage: false
    });
    
    doc.pipe(fs.createWriteStream('output.pdf'));

    images.map((img) => {
        var image = doc.openImage(img);
        doc.addPage({size: [image.width, image.height]});
        doc.image(image, 0, 0);
    });
    doc.end();
}

function download(uri, filename, callback){
    uri = uri.replace('size=900', 'size=1800')
    request.get(uri, function(err, res, body){
      console.log('content-type:', res.headers['content-type']);
      console.log('content-length:', res.headers['content-length']);
      request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
  };