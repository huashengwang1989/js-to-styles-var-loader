![Build Status](https://travis-ci.org/tompascall/js-to-styles-var-loader.svg?branch=master) [![Coverage Status](https://coveralls.io/repos/github/tompascall/js-to-styles-var-loader/badge.svg?branch=master)](https://coveralls.io/github/tompascall/js-to-styles-var-loader?branch=master)

## js-to-styles-var-loader

Forked from tompascall's project [js-to-styles-var-loader](https://github.com/tompascall/js-to-styles-var-loader).

Please read from the original project page for the details.

I am currently working on the `dev` branch. `master` branch is still the original project.

### Problemm to Solve

I am using selected components from iView, which `less` is used. iView provides a template `less` file, with a long list of variables which you can select from to overwrite its default styles.

My project uses Vue.js, and `scss` is used in the template file. I would like to have a list of set style variables in `scss`.

Meanwhile, in many cases, the JavaScripts inside the Vue components would like to know the styles.

To make the styles consistent inside a project, it would be best if the styles where the above-mentioned 3 places would like to reference are the same. However, it would be rather silly to maintain a `less` file, an `scss` file and a `js` file for almost the same contents.

To solve this problem, the project has the following files:

- `shared_variables.styles.js`: exports a js Object for styles to be shared across iView and my own styles
- `iview_overwrite.less`: imports `shared_variables.styles.js`, plus some additional `less` variables
- `common.styles.js`: imports `shared_variables.styles.js`, plus some additional styles in js, and exports a js Object.
- `common.scss`: imports `common.styles.js`, plus some additional `scss`. The additionals would not be available for js.

`common.scss` would be injected at the top of the `scss` styles in every `.vue` Vue template file with `sass-resources-loader`.

`common.styles.js` can be imported in the `main.js` or `app.js` of a project and set as global parameter.


This is to solve the following issues:

- The original loader "cleverly" detects which processor to use (`less` or `sass`) by looking at the loader filenames. However, this would not work when the `scss` variables are to be injected into the Vue temple files. To solve the problem, I added a `useProcessor` option.

- Updated the RegEx check for `require` function so that webpack alias etc. can be supported.

For example, in `webpack.config.js`:
```
{
    test: /\.vue$/,
    use: [
        {
            loader: 'vue-loader',
            options: {
                extractCSS: true,
                loaders: {
                'css': 'vue-style-loader!css-loader',
                'less': 'vue-style-loader!css-loader!less-loader',
                'scss': [
                    'vue-style-loader',
                    'css-loader',
                    'postcss-loader',
                    'sass-loader',
                    //'js-to-styles-var-loader', <= original loader would not work
                    {
                        loader: 'js-to-styles-var-loader',
                        options: {
                            useProcessor: 'scss', // specify it is 'sass', 'scss' or 'less'
                        }
                    },
                    {
                        loader: 'sass-resources-loader',
                        options: {
                            resources: path.resolve(__dirname, 'my_directory_to_styles/common.scss'),
                        },
                    },
                ],
                // ...
            }
        }
    ]
},
{
    test: /\.scss$/,
    use: [
        MiniCssExtractPlugin.loader,
        'css-loader',
        {
            loader: 'sass-loader',
            options: {
                importer: sassJsonImporter,
            }
        },
        {
            loader: 'js-to-styles-var-loader', 
            options: {
                useProcessor: 'scss',
            }
        },
        {
            loader: 'sass-resources-loader',
            options: {
                resources: path.resolve(__dirname, 'my_directory_to_styles/common.scss'),
            }
        }
    ]
}
 ```
