import angular from "angular";
import alldebridService from "services/alldebrid";

export default angular
  .module("webui.ctrls.download", [
    "ui.bootstrap",
    "webui.services.utils",
    "webui.services.rpc",
    "webui.services.rpc.helpers",
    "webui.services.alerts",
    "webui.services.settings",
    "webui.services.modals",
    "webui.services.configuration",
    "webui.services.errors",
    "webui.services.alldebrid"
  ])
  .controller("MainCtrl", [
    "$scope",
    "$name",
    "$enable",
    "$rpc",
    "$rpchelpers",
    "$utils",
    "$alerts",
    "$modals",
    "$fileSettings",
    "$activeInclude",
    "$waitingExclude",
    "$pageSize",
    "$getErrorStatus",
    // for document title
    "$rootScope",
    "$filter",
    "$modal",
    "$alldebrid",
    function(
      scope,
      name,
      enable,
      rpc,
      rhelpers,
      utils,
      alerts,
      modals,
      fsettings,
      activeInclude,
      waitingExclude,
      pageSize,
      getErrorStatus,
      rootScope,
      filter,
      $modal,
      $alldebrid
    ) {
      // UI: gestion de l'upload AllDebrid et de la clé API
      modals.register("getAllDebrid", function(args, closeCb) {
        console.log("🎭 Ouverture modal AllDebrid");
        console.log("🔑 Clé API initiale:", scope.alldebridApiKey);

        var modalScope = scope.$new(true);
        Object.assign(modalScope, scope);

        // S'assurer que la clé API est bien copiée
        modalScope.alldebridApiKey =
          scope.alldebridApiKey || localStorage.getItem("alldebridApiKey") || "";
        console.log("🔑 Clé API dans modalScope:", modalScope.alldebridApiKey);

        $modal
          .open({
            templateUrl: "getAllDebrid.html",
            scope: modalScope
          })
          .result.finally(function() {
            console.log("🎭 Fermeture modal AllDebrid");
            // Synchroniser les changements du modalScope vers le scope principal
            scope.alldebridApiKey = modalScope.alldebridApiKey;
            console.log("🔄 Clé API synchronisée:", scope.alldebridApiKey);
            if (closeCb) closeCb();
          });
      });
      scope.openAllDebridModal = function() {
        // Synchroniser avant l'ouverture
        scope.alldebrid.apiKey =
          scope.alldebridApiKey || localStorage.getItem("alldebridApiKey") || "";

        console.log("🚀 Ouverture modal AllDebrid avec clé:", scope.alldebrid.apiKey);

        modals.invoke("getAllDebrid", scope.alldebrid, function() {
          // Synchroniser après la fermeture
          scope.alldebridApiKey = scope.alldebrid.apiKey;
          console.log("🔄 Synchronisation après fermeture modal:", scope.alldebridApiKey);
        });
      };
      scope.downloadPath = "";

      // Chargement initial de la clé API - utiliser un objet pour le binding
      scope.alldebrid = {
        apiKey: localStorage.getItem("alldebridApiKey") || "",
        apiKeySaved: false,
        error: null,
        success: null,
        links: null
      };

      console.log("🔄 Chargement initial - Clé API récupérée:", scope.alldebrid.apiKey);
      console.log("🔄 Chargement initial - localStorage:", localStorage.getItem("alldebridApiKey"));

      // Compatibilité avec l'ancien code
      scope.alldebridApiKey = scope.alldebrid.apiKey;
      scope.alldebridApiKeySaved = scope.alldebrid.apiKeySaved;

      scope.saveAllDebridApiKey = function() {
        console.log("🔑 === DÉBUT SAUVEGARDE API KEY ===");
        console.log("🔍 Context du scope:", this);
        console.log("🔍 Scope actuel:", scope === this ? "scope principal" : "scope différent");
        console.log(
          "🔑 Clé API depuis l'objet alldebrid (scope):",
          scope.alldebrid ? scope.alldebrid.apiKey : "objet manquant"
        );
        console.log(
          "🔑 Clé API depuis l'objet alldebrid (this):",
          this.alldebrid ? this.alldebrid.apiKey : "objet manquant"
        );
        console.log("🔑 Clé API depuis scope direct:", scope.alldebridApiKey);
        console.log("🔑 Clé API depuis this direct:", this.alldebridApiKey);

        var apiKey =
          (this.alldebrid && this.alldebrid.apiKey) ||
          (scope.alldebrid && scope.alldebrid.apiKey) ||
          this.alldebridApiKey ||
          scope.alldebridApiKey ||
          "";
        console.log("🔑 Clé API finale utilisée:", apiKey);
        console.log("🔑 Type de la clé:", typeof apiKey);
        console.log("🔑 Longueur de la clé:", apiKey ? apiKey.length : 0);
        console.log("🔑 Clé vide ou undefined?", !apiKey);

        if (!apiKey || apiKey.trim() === "") {
          console.log("❌ Clé API vide, sauvegarde annulée");
          if (scope.alldebrid) {
            scope.alldebrid.error = "Veuillez entrer une clé API valide";
          } else {
            scope.alldebridError = "Veuillez entrer une clé API valide";
          }
          return;
        }

        try {
          localStorage.setItem("alldebridApiKey", apiKey);
          console.log("💾 Clé sauvegardée dans localStorage");

          // Vérifier que la sauvegarde a bien fonctionné
          var savedKey = localStorage.getItem("alldebridApiKey");
          console.log("✅ Clé récupérée depuis localStorage:", savedKey);
          console.log("🔄 Comparaison clés égales:", savedKey === apiKey);

          // Mettre à jour le service AllDebrid
          $alldebrid.setApiKey(apiKey);
          console.log("🔧 Service AllDebrid mis à jour avec la nouvelle clé");

          // Mettre à jour tous les scopes
          if (scope.alldebrid) {
            scope.alldebrid.apiKey = apiKey;
            scope.alldebrid.apiKeySaved = true;
            scope.alldebrid.error = null;
          }
          scope.alldebridApiKey = apiKey;
          scope.alldebridApiKeySaved = true;
          scope.alldebridError = null;

          console.log("✨ Indicateur de sauvegarde affiché");

          setTimeout(function() {
            scope.$apply(function() {
              if (scope.alldebrid) {
                scope.alldebrid.apiKeySaved = false;
              }
              scope.alldebridApiKeySaved = false;
              console.log("⏰ Indicateur de sauvegarde masqué");
            });
          }, 2000);
        } catch (error) {
          console.error("❌ Erreur lors de la sauvegarde:", error);
          var errorMsg = "Erreur lors de la sauvegarde: " + error.message;
          if (scope.alldebrid) {
            scope.alldebrid.error = errorMsg;
          } else {
            scope.alldebridError = errorMsg;
          }
        }

        console.log("🔑 === FIN SAUVEGARDE API KEY ===");
      };

      scope.uploadAllDebridTorrent = function() {
        console.log("🚀 === DÉBUT UPLOAD ALLDEBRID TORRENT ===");
        console.log("🔑 Clé API actuelle dans scope:", scope.alldebridApiKey);
        console.log("🔑 Clé depuis localStorage:", localStorage.getItem("alldebridApiKey"));
        console.log("🔑 Type de la clé:", typeof scope.alldebridApiKey);
        console.log("🔑 Clé vide?", !scope.alldebridApiKey);

        // Réinitialiser les états
        scope.alldebridLinks = null;
        scope.alldebridError = null;
        scope.alldebridSuccess = null;

        // Initialiser la progression
        scope.alldebridProgress = {
          show: false,
          current: 0,
          total: 1,
          message: "Initialisation...",
          rateLimitInfo: null
        };

        // Vérifier la clé API
        var apiKey = scope.alldebridApiKey || localStorage.getItem("alldebridApiKey");
        if (!apiKey || apiKey.trim() === "") {
          console.log("❌ Aucune clé API configurée");
          scope.alldebridError = "Veuillez d'abord configurer votre clé API AllDebrid.";
          return;
        }

        console.log("🔍 Recherche de l'élément input file...");
        // Chercher d'abord dans la modal, puis dans l'ancienne interface
        var input =
          document.getElementById("alldebrid-torrent-modal") ||
          document.getElementById("alldebrid-torrent");
        console.log("📂 Élément input trouvé:", !!input);
        console.log("📂 Input ID:", input ? input.id : "aucun");
        console.log("📂 Input files:", input ? input.files : "aucun");
        console.log("📂 Nombre de fichiers:", input && input.files ? input.files.length : 0);

        if (!input) {
          console.log("❌ Élément input file non trouvé");
          scope.alldebridError = "Erreur: élément de sélection de fichier non trouvé.";
          return;
        }

        if (!input.files || !input.files.length) {
          console.log("❌ Aucun fichier sélectionné");
          scope.alldebridError = "Veuillez sélectionner un fichier .torrent.";
          return;
        }

        var file = input.files[0];
        console.log("📁 Fichier sélectionné:", file.name);
        console.log("📁 Taille du fichier:", file.size, "bytes");
        console.log("📁 Type MIME:", file.type);

        // Récupération du chemin de téléchargement depuis plusieurs sources possibles
        var path = "";
        if (this.downloadPath) {
          path = this.downloadPath;
          console.log("📁 Chemin depuis this.downloadPath (modalScope):", path);
        } else if (scope.downloadPath) {
          path = scope.downloadPath;
          console.log("📁 Chemin depuis scope.downloadPath (mainScope):", path);
        } else {
          // Fallback: chercher dans l'élément DOM directement
          var pathInput = document.getElementById("download-path-modal");
          console.log("📁 Element DOM trouvé:", pathInput);
          console.log(
            "📁 Valeur de l'élément:",
            pathInput ? pathInput.value : "Element inexistant"
          );
          if (pathInput && pathInput.value) {
            path = pathInput.value;
            console.log("📁 Chemin depuis DOM direct:", path);
          } else {
            console.log("⚠️ Aucun chemin trouvé dans toutes les sources");
          }
        }

        console.log("📁 Chemin de téléchargement final:", path);

        // Afficher la progression
        scope.alldebridProgress.show = true;
        scope.alldebridProgress.message = "Upload du torrent vers AllDebrid...";
        scope.alldebridError = null;

        console.log("🔧 Configuration du service AllDebrid avec la clé:", apiKey);
        $alldebrid.setApiKey(apiKey);

        console.log("🌐 Début de l'upload vers AllDebrid...");

        // Callback de progression
        var progressCallback = function(current, total, message) {
          scope.$apply(function() {
            scope.alldebridProgress.current = current;
            scope.alldebridProgress.total = total;
            scope.alldebridProgress.message = message;
            scope.alldebridProgress.rateLimitInfo =
              "Respecte les limites AllDebrid: 12 req/sec, 600 req/min";
          });
        };

        $alldebrid.uploadTorrentToAllDebrid(file, progressCallback, function(err, links) {
          console.log("📥 Réponse de AllDebrid reçue");
          console.log("❌ Erreur:", err);
          console.log("🔗 Liens:", links);

          // Masquer la progression
          scope.alldebridProgress.show = false;

          if (err) {
            console.log("❌ Erreur lors de l'upload:", err);
            scope.alldebridError =
              typeof err === "string" ? err : (err && err.message) || "Erreur inconnue.";
            scope.alldebridLinks = null;
          } else {
            console.log("✅ Upload réussi, liens reçus:", links);
            scope.alldebridLinks = links;
            scope.alldebridError = null;

            // Fonction pour extraire récursivement tous les liens des fichiers AllDebrid
            function extractDownloadLinks(data) {
              var downloadLinks = [];

              // Si c'est un array de liens directs déverrouillés (nouveau format)
              if (Array.isArray(data) && data[0] && data[0].link && data[0].name) {
                console.log("📋 Format liens directs déverrouillés détecté");
                data.forEach(function(linkObj) {
                  downloadLinks.push({
                    name: linkObj.name, // Nouveau format utilise 'name'
                    size: linkObj.size,
                    link: linkObj.link
                  });
                });
                return downloadLinks;
              }

              // Si c'est un array de liens directs (format v4 /magnet/status legacy)
              if (Array.isArray(data) && data[0] && data[0].link && data[0].filename) {
                console.log("📋 Format liens directs v4 détecté (legacy)");
                data.forEach(function(linkObj) {
                  downloadLinks.push({
                    name: linkObj.filename, // Ancien format utilise 'filename'
                    size: linkObj.size,
                    link: linkObj.link
                  });
                });
                return downloadLinks;
              }

              // Sinon c'est le format files hiérarchique (format /magnet/files)
              console.log("📋 Format files hiérarchique détecté");
              function extractFromNode(node) {
                if (node.l) {
                  // C'est un fichier avec un lien de téléchargement
                  downloadLinks.push({
                    name: node.n,
                    size: node.s,
                    link: node.l
                  });
                } else if (node.e) {
                  // C'est un dossier, traiter récursivement
                  node.e.forEach(extractFromNode);
                }
              }

              if (Array.isArray(data)) {
                data.forEach(extractFromNode);
              }
              return downloadLinks;
            } // Envoi des liens débridés au serveur via la mécanique existante
            if (links && links.length) {
              console.log("📤 Extraction et envoi des liens vers aria2...");
              var downloadLinks = extractDownloadLinks(links);
              console.log("🔗 Liens extraits:", downloadLinks);

              if (downloadLinks.length > 0) {
                var uris = downloadLinks.map(function(file) {
                  console.log("🔗 Lien traité:", file.link, "pour", file.name);
                  return [file.link];
                });
                var settings = { dir: path };
                console.log("⚙️ Paramètres aria2:", settings);

                rhelpers.addUris(uris, settings, function() {
                  console.log("✅ Liens ajoutés à aria2 avec succès");
                  scope.alldebridSuccess =
                    "Liens envoyés au serveur et ajoutés à la file de téléchargement.";
                  scope.$apply(function() {
                    setTimeout(function() {
                      scope.$apply(function() {
                        scope.alldebridSuccess = null;
                      });
                    }, 4000);
                  });
                });
              } else {
                console.log("⚠️ Aucun lien de téléchargement trouvé dans la réponse AllDebrid");
                scope.alldebridError = "Aucun lien de téléchargement trouvé.";
              }
            } else {
              console.log("⚠️ Aucun fichier reçu d'AllDebrid");
              scope.alldebridError = "Aucun fichier reçu d'AllDebrid.";
            }
          }
          scope.$apply();
          console.log("🚀 === FIN UPLOAD ALLDEBRID TORRENT ===");
        });
      };

      // Télécharge un fichier à l'URL donnée dans le chemin local spécifié
      scope.downloadFileToPath = function(url, filename, path) {
        // Création d'un lien invisible pour déclencher le téléchargement côté navigateur
        var a = document.createElement("a");
        a.href = url;
        a.download = path ? path + "/" + filename : filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      // Ajout AllDebrid : upload et download torrent
      scope.uploadTorrentToAllDebrid = function(file, callback) {
        $alldebrid.uploadTorrentFile(file).then(
          function(magnetId) {
            // Pooling status jusqu'à ce que le magnet soit prêt
            function pollStatus() {
              $alldebrid.getMagnetStatus(magnetId).then(
                function(status) {
                  if (status.statusCode === 4) {
                    // Ready
                    $alldebrid.getFilesLinks(magnetId).then(
                      function(files) {
                        if (callback) callback(null, files);
                      },
                      function(err) {
                        if (callback) callback(err);
                      }
                    );
                  } else if (status.statusCode >= 5) {
                    if (callback) callback("Erreur AllDebrid: " + status.status);
                  } else {
                    setTimeout(pollStatus, 5000);
                  }
                },
                function(err) {
                  if (callback) callback(err);
                }
              );
            }
            pollStatus();
          },
          function(err) {
            if (callback) callback(err);
          }
        );
      };
      scope.name = name; // default UI name
      scope.enable = enable; // UI enable options

      var re_slashes = /\\/g;
      var slash = "/";
      var allStopped = [];

      (scope.active = []), (scope.waiting = []), (scope.stopped = []);
      scope.gstats = {};
      scope.hideLinkedMetadata = true;
      scope.propFilter = "";

      // pause the download
      // d: the download ctx
      scope.pause = function(d) {
        rpc.once("forcePause", [d.gid]);
      };

      // resume the download
      // d: the download ctx
      scope.resume = function(d) {
        rpc.once("unpause", [d.gid]);
      };

      scope.restart = function(d) {
        // assumes downloads which are started by URIs, not torrents.
        // the preferences are also not transferred, just simple restart

        rpc.once("getOption", [d.gid], function(data) {
          var prefs = data[0];
          rpc.once("getFiles", [d.gid], function(data) {
            var files = data[0];
            var uris = _.chain(files)
              .map(function(f) {
                return f.uris;
              })
              .filter(function(uris) {
                return uris && uris.length;
              })
              .map(function(uris) {
                var u = _.chain(uris)
                  .map(function(u) {
                    return u.uri;
                  })
                  .uniq()
                  .value();
                return u;
              })
              .value();

            if (uris.length > 0) {
              console.log("adding uris:", uris, prefs);
              scope.remove(
                d,
                function() {
                  rhelpers.addUris(uris, prefs);
                },
                true
              );
            }
          });
        });
      };

      scope.canRestart = function(d) {
        return ["active", "paused"].indexOf(d.status) == -1 && !d.bittorrent;
      };

      // remove the download,
      // put it in stopped list if active,
      // otherwise permanantly remove it
      // d: the download ctx
      scope.remove = function(d, cb, noConfirm) {
        // HACK to make sure an angular digest is not running, as only one can happen at a time, and confirm is a blocking
        // call so an rpc response can also trigger a digest call
        setTimeout(function() {
          if (
            !noConfirm &&
            !confirm(
              filter("translate")("Remove {{name}} and associated meta-data?", { name: d.name })
            )
          ) {
            return;
          }

          var method = "remove";

          if (scope.getType(d) == "stopped") method = "removeDownloadResult";

          if (d.followedFrom) {
            scope.remove(d.followedFrom, function() {}, true);
            d.followedFrom = null;
          }
          rpc.once(method, [d.gid], cb);

          var lists = [scope.active, scope.waiting, scope.stopped],
            ind = -1,
            i;
          for (var i = 0; i < lists.length; ++i) {
            var list = lists[i];
            var idx = list.indexOf(d);
            if (idx < 0) {
              continue;
            }
            list.splice(idx, 1);
            return;
          }
        }, 0);
      };

      // start filling in the model of active,
      // waiting and stopped download
      rpc.subscribe("tellActive", [], function(data) {
        scope.$apply(function() {
          utils.mergeMap(data[0], scope.active, scope.getCtx);
        });
      });

      rpc.subscribe("tellWaiting", [0, 1000], function(data) {
        scope.$apply(function() {
          utils.mergeMap(data[0], scope.waiting, scope.getCtx);
        });
      });

      rpc.subscribe("tellStopped", [0, 1000], function(data) {
        scope.$apply(function() {
          if (!scope.hideLinkedMetadata) {
            utils.mergeMap(data[0], scope.stopped, scope.getCtx);
            return;
          }
          utils.mergeMap(data[0], allStopped, scope.getCtx);
          var gids = {};
          _.forEach(allStopped, function(e) {
            gids[e.gid] = e;
          });
          _.forEach(scope.active, function(e) {
            gids[e.gid] = e;
          });
          _.forEach(scope.waiting, function(e) {
            gids[e.gid] = e;
          });
          scope.stopped = _.filter(allStopped, function(e) {
            if (!e.metadata || !e.followedBy || !(e.followedBy in gids)) {
              return true;
            }
            var linked = gids[e.followedBy];
            linked.followedFrom = e;
            return false;
          });
        });
      });

      rootScope.pageTitle = utils.getTitle();
      rpc.subscribe("getGlobalStat", [], function(data) {
        scope.$apply(function() {
          scope.gstats = data[0];
          rootScope.pageTitle = utils.getTitle(scope.gstats);
        });
      });

      rpc.once("getVersion", [], function(data) {
        scope.$apply(function() {
          scope.miscellaneous = data[0];
        });
      });

      // total number of downloads, updates dynamically as downloads are
      // stored in scope
      scope.totalDownloads = 0;

      // download search filter
      scope.downloadFilter = "";
      scope.downloadFilterCommitted = "";

      scope.onDownloadFilter = function() {
        if (scope.downloadFilterTimer) {
          clearTimeout(scope.downloadFilterTimer);
        }
        scope.downloadFilterTimer = setTimeout(function() {
          delete scope.downloadFilterTimer;
          if (scope.downloadFilterCommitted !== scope.downloadFilter) {
            scope.downloadFilterCommitted = scope.downloadFilter;
            scope.$digest();
          }
        }, 500);
      };

      scope.filterDownloads = function(downloads) {
        if (!scope.downloadFilterCommitted) {
          return downloads;
        }
        var filter = scope.downloadFilterCommitted
          .replace(/[{}()\[\]\\^$.?]/g, "\\$&")
          .replace(/\*/g, ".*")
          .replace(/\./g, ".");
        filter = new RegExp(filter, "i");
        return _.filter(downloads, function(d) {
          if (filter.test(d.name)) return true;
          return _.filter(d.files, function(f) {
            return filter.test(f.relpath);
          }).length;
        });
      };

      scope.clearFilter = function() {
        scope.downloadFilter = scope.downloadFilterCommitted = "";
      };

      scope.toggleStateFilters = function() {
        scope.filterSpeed = !scope.filterSpeed;
        scope.filterActive = !scope.filterActive;
        scope.filterWaiting = !scope.filterWaiting;
        scope.filterComplete = !scope.filterComplete;
        scope.filterError = !scope.filterError;
        scope.filterPaused = !scope.filterPaused;
        scope.filterRemoved = !scope.filterRemoved;
        scope.persistFilters();
      };

      scope.resetFilters = function() {
        scope.filterSpeed = scope.filterActive = scope.filterWaiting = scope.filterComplete = scope.filterError = scope.filterPaused = scope.filterRemoved = true;
        scope.clearFilter();
        scope.persistFilters();
      };

      scope.persistFilters = function() {
        var o = JSON.stringify({
          s: scope.filterSpeed,
          a: scope.filterActive,
          w: scope.filterWaiting,
          c: scope.filterComplete,
          e: scope.filterError,
          p: scope.filterPaused,
          r: scope.filterRemoved
        });
        utils.setCookie("aria2filters", o);
      };

      scope.loadFilters = function() {
        var o = JSON.parse(utils.getCookie("aria2filters"));
        if (!o) {
          scope.resetFilters();
          return;
        }
        scope.filterSpeed = !!o.s;
        scope.filterActive = !!o.a;
        scope.filterWaiting = !!o.w;
        scope.filterComplete = !!o.c;
        scope.filterError = !!o.e;
        scope.filterPaused = !!o.p;
        scope.filterRemoved = !!o.r;
      };

      scope.loadFilters();

      scope.toggleCollapsed = function(download) {
        if (!download.collapsed) {
          download.animCollapsed = true;
          // ng-unswitch after half a second.
          // XXX hacky way, because I'm to lazy right now to wire up proper
          // transitionend events.
          setTimeout(function() {
            scope.$apply(function() {
              download.collapsed = true;
            });
          }, 500);
          return;
        }

        download.collapsed = false;
        setTimeout(function() {
          scope.$apply(function() {
            download.animCollapsed = false;
          });
        }, 0);
      };

      // max downloads shown in one page
      scope.pageSize = pageSize;

      // current displayed page
      scope.currentPage = 1;

      // total amount of downloads returned by aria2
      scope.totalAria2Downloads = function() {
        return scope.active.length + scope.waiting.length + scope.stopped.length;
      };

      scope.getErrorStatus = function(errorCode) {
        return getErrorStatus(+errorCode);
      };

      // actual downloads used by the view
      scope.getDownloads = function() {
        var categories = [];

        if (scope.filterActive) {
          if (!scope.filterSpeed) {
            categories.push(
              _.filter(scope.active, function(e) {
                return !+e.uploadSpeed && !+e.downloadSpeed;
              })
            );
          } else {
            categories.push(scope.active);
          }
        } else if (scope.filterSpeed) {
          categories.push(
            _.filter(scope.active, function(e) {
              return +e.uploadSpeed || +e.downloadSpeed;
            })
          );
        }

        if (scope.filterWaiting) {
          categories.push(
            _.filter(scope.waiting, function(e) {
              return e.status == "waiting";
            })
          );
        }

        if (scope.filterPaused) {
          categories.push(
            _.filter(scope.waiting, function(e) {
              return e.status == "paused";
            })
          );
        }

        if (scope.filterError) {
          categories.push(
            _.filter(scope.stopped, function(e) {
              return e.status == "error";
            })
          );
        }

        if (scope.filterComplete) {
          categories.push(
            _.filter(scope.stopped, function(e) {
              return e.status == "complete";
            })
          );
        }

        if (scope.filterRemoved) {
          categories.push(
            _.filter(scope.stopped, function(e) {
              return e.status == "removed";
            })
          );
        }

        var downloads = categories
          .map(function(category) {
            // sort downloads within category by completness, most completed first
            return _.sortBy(category, function(e) {
              return -(e.completedLength / e.totalLength);
            });
          })
          .reduce(function(downloads, category) {
            return downloads.concat(category);
          }, []);

        downloads = scope.filterDownloads(downloads);

        scope.totalDownloads = downloads.length;

        downloads = downloads.slice((scope.currentPage - 1) * scope.pageSize);
        downloads.splice(scope.pageSize);

        return downloads;
      };

      scope.hasDirectURL = function() {
        return rpc.getDirectURL() != "";
      };

      scope.getDirectURL = function() {
        return rpc.getDirectURL();
      };

      // convert the donwload form aria2 to once used by the view,
      // minor additions of some fields and checks
      scope.getCtx = function(d, ctx) {
        if (!ctx) {
          ctx = {
            dir: d.dir,
            status: d.status,
            gid: d.gid,
            followedBy: d.followedBy && d.followedBy.length == 1 ? d.followedBy[0] : null,
            followedFrom: null,
            numPieces: d.numPieces,
            connections: d.connections,
            connectionsTitle: "Connections",
            numSeeders: d.numSeeders,
            bitfield: d.bitfield,
            errorCode: d.errorCode,
            totalLength: d.totalLength,
            fmtTotalLength: utils.fmtsize(d.totalLength),
            completedLength: d.completedLength,
            fmtCompletedLength: utils.fmtsize(d.completedLength),
            uploadLength: d.uploadLength,
            fmtUploadLength: utils.fmtsize(d.uploadLength),
            pieceLength: d.pieceLength,
            fmtPieceLength: utils.fmtsize(d.pieceLength),
            downloadSpeed: d.downloadSpeed,
            fmtDownloadSpeed: utils.fmtspeed(d.downloadSpeed),
            uploadSpeed: d.uploadSpeed,
            fmtUploadSpeed: utils.fmtspeed(d.uploadSpeed),
            collapsed: true,
            animCollapsed: true,
            files: []
          };
          if (d.verifiedLength) {
            ctx.verifiedLength = d.verifiedLength;
            ctx.status = "verifying";
          }
          if (d.verifyIntegrityPending) {
            ctx.verifyIntegrityPending = d.verifyIntegrityPending;
            ctx.status = "verifyPending";
          }
        } else {
          if (ctx.gid !== d.gid) ctx.files = [];
          ctx.dir = d.dir;
          ctx.status = d.status;
          if (d.verifiedLength) ctx.status = "verifying";
          if (d.verifyIntegrityPending) ctx.status = "verifyPending";
          ctx.errorCode = d.errorCode;
          ctx.gid = d.gid;
          ctx.followedBy = d.followedBy && d.followedBy.length == 1 ? d.followedBy[0] : null;
          ctx.followedFrom = null;
          ctx.numPieces = d.numPieces;
          ctx.connections = d.connections;
          if (typeof d.numSeeders === "undefined") {
            ctx.numSeeders = "";
          } else {
            ctx.connectionsTitle = "Connections (Seeders)";
            ctx.numSeeders = " (" + d.numSeeders + ")";
          }
          ctx.bitfield = d.bitfield;
          if (ctx.totalLength !== d.totalLength) {
            ctx.totalLength = d.totalLength;
            ctx.fmtTotalLength = utils.fmtsize(d.totalLength);
          }
          if (ctx.completedLength !== d.completedLength) {
            ctx.completedLength = d.completedLength;
            ctx.fmtCompletedLength = utils.fmtsize(d.completedLength);
          }
          if (!d.verifiedLength) {
            delete ctx.verifiedLength;
          } else if (ctx.verifiedLength !== d.verifiedLength) {
            ctx.verifiedLength = d.verifiedLength;
          }
          if (!d.verifyIntegrityPending) {
            delete ctx.verifyIntegrityPending;
          } else if (ctx.verifyIntegrityPending !== d.verifyIntegrityPending) {
            ctx.verifyIntegrityPending = d.verifyIntegrityPending;
          }
          if (ctx.uploadLength !== d.uploadLength) {
            ctx.uploadLength = d.uploadLength;
            ctx.fmtUploadLength = utils.fmtsize(d.uploadLength);
          }
          if (ctx.pieceLength !== d.pieceLength) {
            ctx.pieceLength = d.pieceLength;
            ctx.fmtPieceLength = utils.fmtsize(d.pieceLength);
          }
          if (ctx.downloadSpeed !== d.downloadSpeed) {
            ctx.downloadSpeed = d.downloadSpeed;
            ctx.fmtDownloadSpeed = utils.fmtspeed(d.downloadSpeed);
          }
          if (ctx.uploadSpeed !== d.uploadSpeed) {
            ctx.uploadSpeed = d.uploadSpeed;
            ctx.fmtUploadSpeed = utils.fmtspeed(d.uploadSpeed);
          }
        }

        var dlName;
        var files = d.files;
        if (files) {
          var cfiles = ctx.files;
          for (var i = 0; i < files.length; ++i) {
            var cfile = cfiles[i] || (cfiles[i] = {});
            var file = files[i];
            if (file.path !== cfile.path) {
              cfile.index = +file.index;
              cfile.path = file.path;
              cfile.length = file.length;
              cfile.fmtLength = utils.fmtsize(file.length);
              cfile.relpath = file.path.replace(re_slashes, slash);
              if (!cfile.relpath) {
                cfile.relpath = (file.uris && file.uris[0] && file.uris[0].uri) || "Unknown";
              } else if (!cfile.relpath.startsWith("[")) {
                // METADATA
                cfile.relpath = cfile.relpath.substr(ctx.dir.length + 1);
              }
            }
            cfile.selected = file.selected === "true";
          }
          cfiles.length = files.length;
          if (cfiles.length) {
            dlName = cfiles[0].relpath;
          }
        } else {
          delete ctx.files;
        }

        var btName;
        if (d.bittorrent) {
          btName = d.bittorrent.info && d.bittorrent.info.name;
          ctx.bittorrent = true;
        } else {
          delete ctx.bittorrent;
        }

        ctx.name = btName || dlName || "Unknown";
        ctx.metadata = ctx.name.startsWith("[METADATA]");
        if (ctx.metadata) {
          ctx.name = ctx.name.substr(10);
        }

        return ctx;
      };

      scope.hasStatus = function hasStatus(d, status) {
        if (_.isArray(status)) {
          if (status.length == 0) return false;
          return hasStatus(d, status[0]) || hasStatus(d, status.slice(1));
        } else {
          return d.status == status;
        }
      };

      // get time left for the download with
      // current download speed,
      // could be smarter by different heuristics
      scope.getEta = function(d) {
        return (d.totalLength - d.completedLength) / d.downloadSpeed;
      };

      scope.getProgressClass = function(d) {
        switch (d.status) {
          case "paused":
            return "progress-bar-info";
          case "error":
            return "progress-bar-danger";
          case "removed":
            return "progress-bar-warning";
          case "active":
            return "active";
          case "verifying":
            return "progress-bar-warning";
          case "complete":
            return "progress-bar-success";
          default:
            return "";
        }
      };

      // gets the progress in percentages
      scope.getProgress = function(d) {
        var percentage = 0;
        if (d.verifiedLength) percentage = (d.verifiedLength / d.totalLength) * 100 || 0;
        else percentage = (d.completedLength / d.totalLength) * 100 || 0;
        percentage = percentage.toFixed(2);
        if (!percentage) percentage = 0;

        return percentage;
      };

      // gets the upload ratio
      scope.getRatio = function(d) {
        var ratio = 0;
        ratio = d.uploadLength / d.completedLength || 0;
        ratio = ratio.toFixed(2);
        if (!ratio) ratio = 0;

        return ratio;
      };

      // gets the type for the download as classified by the aria2 rpc calls
      scope.getType = function(d) {
        var type = d.status;
        if (type == "paused") type = "waiting";
        if (["error", "removed", "complete"].indexOf(type) != -1) type = "stopped";
        return type;
      };

      scope.selectFiles = function(d) {
        console.log("got back files for the torrent ...");
        modals.invoke("selectFiles", d.files, function(files) {
          var indexes = "";
          _.forEach(files, function(f) {
            if (f.selected) {
              indexes += "," + f.index;
            }
          });

          indexes = indexes.slice(1);
          rpc.once("changeOption", [d.gid, { "select-file": indexes }], function(res) {
            console.log("changed indexes to:", indexes, res);
          });
        });
      };

      scope.showSettings = function(d) {
        var type = scope.getType(d),
          settings = {};

        rpc.once("getOption", [d.gid], function(data) {
          var vals = data[0];

          var sets = _.cloneDeep(fsettings);
          for (var i in sets) {
            if (type == "active" && activeInclude.indexOf(i) == -1) continue;

            if (type == "waiting" && waitingExclude.indexOf(i) != -1) continue;

            settings[i] = sets[i];
            settings[i].val = vals[i] || settings[i].val;
          }
          modals.invoke("settings", settings, d.name + " settings", "Change", function(settings) {
            var sets = {};
            for (var i in settings) {
              sets[i] = settings[i].val;
            }

            rpc.once("changeOption", [d.gid, sets]);
          });
        });

        return false;
      };
      scope.moveDown = function(d) {
        rpc.once("changePosition", [d.gid, 1, "POS_CUR"]);
      };
      scope.moveUp = function(d) {
        rpc.once("changePosition", [d.gid, -1, "POS_CUR"]);
      };
    }
  ])
  .filter("objFilter", function() {
    return function(input, filter) {
      input = input || {};
      var out = {};

      for (var key in input) {
        if (key.startsWith(filter)) {
          out[key] = input[key];
        }
      }

      return out;
    };
  }).name;
