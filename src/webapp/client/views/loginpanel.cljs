(ns webapp.client.views.loginpanel
    (:refer-clojure :exclude [val empty remove find next parents])
    (:require
        [cljs.reader :as reader]
        [crate.core :as crate]
        [cljs.core.async :as async :refer [chan close!]]
        [clojure.string]
    )
    (:use
        [webapp.framework.client.coreclient :only [body-html new-dom-id debug popup hide-popovers
                                                   show-popover set-text value-of find-el sql-fn neo4j-fn
                                                   swap-section el clear remote  add-to on-mouseover-fn on-click-fn]]
        [jayq.core                          :only [$ css  append fade-out fade-in empty attr bind]]
        [webapp.framework.client.help       :only [help]]
        [webapp.framework.client.eventbus   :only [do-action esb undefine-action]]
        [domina                             :only [ by-id value destroy! ]]
  )
  (:require-macros
    [cljs.core.async.macros :refer [go alt!]])
  (:use-macros
        [webapp.framework.client.eventbus :only [redefine-action define-action]]
        [webapp.framework.client.coreclient :only [ns-coils makeit defn-html on-click on-mouseover sql defn-html defn-html2 neo4j]]
        [webapp.framework.client.interpreter :only [! !! !!!]]
     )
)
(ns-coils 'webapp.client.views.loginpanel)

;(ns-coils-debug)

(defn neo-data [x] (first x))
(defn neo-keys [x] (-> x (neo-data) (keys)))
(defn neo-result [x k] (-> x (neo-data) (get k)))
(defn neo-result-keys [x k] (-> x (neo-data) (get k) (keys)))
(defn neo-properties [x k] (-> x (neo-data) (get k) (get :data)))
(defn neo-incoming [x k] (-> x (neo-data) (get k) :incoming_relationships))
(defn neo-outgoing [x k] (-> x (neo-data) (get k) :outgoing_relationships))


(comment go
   (.log js/console (str (neo-outgoing (<! (neo4j "START x = node(0) RETURN x" {} )) "x")))
)

(comment go
   (.log js/console (str (neo-incoming (<! (neo4j "START x = node(0) RETURN x" {} )) "x")))
)

(comment  go
   (.log js/console (str (neo-result (<! (neo4j "START x = node(0) RETURN x" {} )) "x")))
)


(defn neo-id [x]
  (comment  go
      (get (first (<! (neo4j "START x = node(1) RETURN ID(x)" {} ) "x")) "ID(x)")
  )
)

(comment go
    (.log js/console (str  (first (<! (neo-id nil)))))

 )

(comment  go
   (.log js/console

         (let [
               rr (<! (neo4j "CREATE (n {name : {value} , title : 'Developer'}) return n" {:value "Zubair"}  ) )
               ]
         (str
          (neo-properties
               rr
               "n")
          " : ID : "
          (<! (neo-id rr))
               ))))


;(makeit "fdsfd")
(comment go
 (.log js/console (str (<! (sql "SELECT * FROM users " [] ))))
)

(redefine-action "Send me my password"
  (let
    [
       username    (message :username)
     ]
       (go
         (let [
                 search-db-for-user   (<! (sql "SELECT * FROM users where user_name = ?"
                                      [username] ))
                 user-already-exists  (pos? (count search-db-for-user))
              ]
                 (if user-already-exists
                     (do

                         (.log js/console "sending password")
                         (.log js/console (str (<! (remote "send-password" {:email username}))))
                     )

                     (popup :title "Can't find you"
                            :body-html "<div>Try another email<div/>")
                  )
         )
  )
    ))






(defn-html forgot-password-panel-html []
  (el :form {:class "form-inline" :style "padding: 5px"}
      [
       (el :div {:class "form-group"} [
        "<input  id='username-input' type='email' class='input-small form-control' placeholder='Email'>"
        ])

       (el :button {
                     :id       "reset-password-button"
                     :type     "button"
                     :class    "btn btn-primary"
                     :style    "margin-left: 10px;"
                     :text     "Send me my password"
                     :onclick  #(do-action "Send me my password"
                                           {
                                            :username    (value-of "username-input")
                                            })})

        (el :button {
                     :type "button"
                     :class "btn btn-info"
                     :style "margin-left: 10px;"
                     :text "Cancel"
                     :onclick #(do-action "show login signup panel")})

      ]
  )
)








(defn-html login-panel-html []
  (el :form {:class "form-inline" :style "padding: 5px"}
      [
       (el :div {:class "form-group"} [
        "<input  id='username-input'  type='email' placeholder='me@example.com' class='input-small form-control'>"
        ])
       (el :div {:class "form-group"} [
        "<input  id='password-input' type='password' class='input-small form-control' placeholder='Password'>"
        ])
        ;"<div class='checkbox' style='margin-left: 10px;'>
        ;    <label>
        ;      <input type='checkbox'> Remember me
        ;    </label>
        ;  </div>"

       (el :button {
                     :id       "signup-button"
                     :type     "button"
                     :class    "btn btn-primary"
                     :style    "margin-left: 10px;"
                     :text     "Login"
                     :onclick  #(do-action "login user"
                                           {
                                            :username    (value-of "username-input")
                                            :password    (value-of "password-input")
                                            })})

        (el :button {
                     :type "button"
                     :class "btn btn-info"
                     :style "margin-left: 10px;"
                     :text "Cancel"
                     :onclick #(do-action "show login signup panel")})

      ]
  )
)







(defn-html signup-panel-html []
  (el :form {:class "form-inline" :role "form" :style "padding: 5px"}
      [
       (el :div {:class "form-group"} [
           "<input  id='username-input' type='email' class='input-small form-control' placeholder='Email'>"
        ])
       (el :div {:class "form-group"} [
       "<input  id='password-input' type='password' class='input-small form-control' placeholder='Password'>"
        ])

       (el :button {
                     :id       "signup-button"
                     :type     "button"
                     :class    "btn btn-primary"
                     :style    "margin-left: 10px;"
                     :text     "Sign up"
                     :onclick  #(do-action "signup user"
                                           {
                                            :username    (value-of "username-input")
                                            :password    (value-of "password-input")
                                            })})

       (el :button {
                     :type "button"
                     :class "btn btn-info"
                     :style "margin-left: 10px;"
                     :text "Cancel"
                     :onclick #(do-action "show login signup panel")})
      ]
  )
)









(defn-html forgot-password-button-html [& {:keys [do-after-click]}]

  (el :div {:style "display:inline;"} [
      (el :button
                          {:id       "forgot-password-button"
                           :style    "margin: 5px; "
                           :class    "btn btn-default"
                           :text     "Forgot password?"
                           :onclick  #(do
                                       (swap-section
                                                ($ :#top-right)
                                                (forgot-password-panel-html))


                                       (.log js/console (str "do-after-click: "  do-after-click))
                                       (if do-after-click
                                         (do-after-click))

                                       )
                           })]))






(defn-html wrong-email-html []

  (el :div {:class "pull-right"} [

        (body-html "<div>Problem signing in. Please check that the email and  password are correct")

        (forgot-password-button-html :do-after-click
                                          #(do
                                             (swap-section "main-section" "<div></div>"
                                               (fn[] (show-popover
                                                        "username-input"
                                                        "Enter the password you signed up with here"
                                                        {:placement "bottom"}))
                                             )
                                          ))


              ])


)


(defn-html login-signup-panel-html []

  (el :div {:class "pull-right"} [
        (el :button
                          {:id    "login-button"
                           :style "margin: 5px; "
                           :class "btn btn-default"
                           :text "login"
                           :onclick #(swap-section
                                                ($ :#top-right)
                                                (login-panel-html))
;                           :onmouseover #(show-popover "login-button"
;                                                       "Use this if you already have an account")
;                           :onmouseout #(hide-popovers)
                           })

        (el :button
                          {:id    "signup-button"
                           :style "margin: 5px;"
                           :class "btn btn-default"
                           :text "Sign up"
                           :onclick #(swap-section
                                                ($ :#top-right)
                                                (signup-panel-html))
                           })

        (forgot-password-button-html {})


              ])


)







(defn-html logged-in-panel []
    (el :div {:class "row" :style "padding: 5px; width:400px;"} [
        (el :div
                          {:id    "signed-in-as-text"
                           :text  "Signing in..."
                           :class "pull-left"
                           :style "margin-right: 20px; margin-top:10px;"

         })

        (el :button
                          {:id      "logout-button"
                           :class   "btn btn-default "
                           :text    "Logout"
                           :style   "margin-right: 20px;"
                           :onclick #(do-action "show login signup panel")})

        (el :button
                          {:id      "settings-button"
                           :class   "btn btn-default"
                           :text    "Settings"
                           :style   "margin-right: 20px;"
         })

]))










(redefine-action  "show login signup panel"

    (swap-section "top-right" (login-signup-panel-html))
)






(redefine-action "signup user"
   (go
     (let [
             username             (:username message)
             password             (:password message)
             search-db-for-user   (<! (sql "SELECT * FROM users where user_name = ?"
                                  [username] ))
             user-already-exists  (pos? (count search-db-for-user))
          ]
             (cond
                  user-already-exists
                      (.log js/console "user already exists")

                  (= (count password) 0)
                      (show-popover "password-input"
                                       "Password cannot be empty"
                                       {:placement "bottom"})

                 :else
                       (do
                           (<! (sql "insert into users (user_name, password) values (?,?)"
                                     [username,password] ))
                           (.log js/console "Created user " username)
                           (do-action "show logged in panel")
                           (let [
                                 created-user (first (<! (sql "SELECT * FROM users where user_name = ?"
                                                    [username] )))]
                                    (.log js/console "Created user " created-user)
                                    (do-action "set logged in user" created-user)
                           )
                        )
              )
     )
  )
)




(defn contains-string [x y]
    (> (. x indexOf y) -1))




(defn validate-email [email]
    (cond
        (clojure.string/blank? email)            {:valid false :error "Email cannot be empty"}
        (= (contains-string email "@") false)    {:valid false :error "Email must contain @ character"}
        :else                                    {:valid true}
    )
)






(redefine-action "login user"
   (go
     (let [
             username             (:username message)
             password             (:password message)
             validity             (validate-email  username)
             is-valid?            (:valid validity)
           ]
           (cond

              is-valid?


                   (let [
                         search-db-for-user   (<! (remote "login-user" {:username username :password password}))
                         user-record-from-db  (first search-db-for-user)
                         ]
                         (if user-record-from-db
                           (do
                             (.log js/console (str "Logged in as user " user-record-from-db))
                             (do-action "show logged in panel")
                             (do-action "set logged in user" user-record-from-db)
                           )

                           (do
                             ;(show-popover "username-input"
                             ;            "<br>User does not exist. Please check that the email and  password are correct"
                             ;           {:placement "left"})
                             (swap-section "main-section" (wrong-email-html))
                           )))


            :else
                    (show-popover "username-input"
                                  (:error validity))



            ))))














(redefine-action "show logged in panel"

    (do
      (clear "top-right")
      (add-to "top-right" (logged-in-panel))
    )
)








(redefine-action "update current user"
  (let [
        user message
        ]
         (swap-section "signed-in-as-text"
                       (str "<div>Signed in as " (:user_name user) "</div>"))
 ))









;(do-action "show login signup panel")
;(do-action "signup user" {:username "name22"})
;(do-action "show login panel")


